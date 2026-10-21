import { Request, Response } from 'express';
import { getDb } from '../config/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { ProviderRepository } from '../repositories/providerRepository';
import { saveFileToCloud } from '../utils/fileHelper';
import { 
  getUsersBatch, 
  getCatalogBatch,
  getLocationsBatch
} from '../utils/internalApi';

interface ResolvedUser {
  _id: string;
  name: string;
  email: string;
}

interface ResolvedSubService {
  _id: string;
  subservice_name: string;
}

// @desc    Add service to provider profile
// @route   POST /api/provider-services
// @access  Private/Provider
export const addProviderService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      provider_id,
      experience,
      price,
      discount,
      final_price,
      location_ids,
      subservice_ids,
      documents,
      is_featured,
      is_available
    } = req.body;

    if (experience === undefined || experience === null) {
      res.status(400).json({ message: 'Experience is required.' });
      return;
    }

    const effectivePrice = Number(price) > 0 ? Number(price) : 299;

    const pool = getDb();

    // Enforce max 2 categories per provider
    const existingServicesRes = await pool.query(
      `SELECT ps.id, COALESCE(array_agg(pss.subservice_id::text) FILTER (WHERE pss.subservice_id IS NOT NULL), '{}') AS subservice_ids
       FROM provider.provider_services ps
       LEFT JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
       WHERE (ps.provider_id::text = $1 OR ps.provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
         AND ps.is_active = TRUE
       GROUP BY ps.id`,
      [provider_id]
    );

    const existingSubserviceIds = existingServicesRes.rows.flatMap(r => r.subservice_ids || []);
    const allSubserviceIds = [
      ...existingSubserviceIds,
      ...(subservice_ids || []).map((id: string) => String(id))
    ];

    if (allSubserviceIds.length > 0) {
      const catalogData = await getCatalogBatch(allSubserviceIds, [], [], []);
      
      const normalizeGender = (g?: string | null): 'MALE' | 'FEMALE' | 'ANY' => {
        if (!g) return 'ANY';
        const up = g.trim().toUpperCase();
        if (up === 'MALE' || up === 'MEN' || up === 'MAN') return 'MALE';
        if (up === 'FEMALE' || up === 'WOMEN' || up === 'WOMAN') return 'FEMALE';
        return 'ANY';
      };

      const providerDoc = await ProviderRepository.findById(provider_id);
      const provGender = normalizeGender(providerDoc?.gender);

      for (const sub of catalogData.subservices || []) {
        const subReqGender = normalizeGender(sub.required_gender || sub.genderApplicability);
        if (subReqGender !== 'ANY' && provGender !== 'ANY' && provGender !== subReqGender) {
          res.status(400).json({
            code: 'GENDER_REQUIREMENT_NOT_MET',
            message: `Provider gender does not meet the requirement (${subReqGender}) for this service.`
          });
          return;
        }
      }

      const serviceIds = (catalogData.subservices || []).map((s: any) => String(s.service_id));
      const serviceCatalogData = await getCatalogBatch([], serviceIds, [], []);
      const categoryIds = (serviceCatalogData.services || []).map((s: any) => String(s.category_id));

      const uniqueCategoryIds = new Set(categoryIds);
      if (uniqueCategoryIds.size > 2) {
        res.status(400).json({ message: 'A provider can offer services in a maximum of 2 categories.' });
        return;
      }
    }

    const processedDocs = [];
    if (Array.isArray(documents)) {
      for (const doc of documents) {
        if (doc.file_url && doc.file_url.startsWith('data:')) {
          const cloudRes = await saveFileToCloud(doc.file_url, 'services/docs');
          if (typeof cloudRes === 'object') {
            processedDocs.push({
              ...doc,
              file_url: cloudRes.secure_url,
              public_id: cloudRes.public_id,
              resource_type: cloudRes.resource_type
            });
          } else {
            processedDocs.push({ ...doc, file_url: cloudRes });
          }
        } else {
          processedDocs.push(doc);
        }
      }
    }

    const discountPerc = Number(discount) || 0;
    const finalPrice = Number(final_price) || effectivePrice;

    const insertServiceRes = await pool.query(
      `INSERT INTO provider.provider_services (
         provider_id, price, discount_percentage, currency, is_active
       ) VALUES (
         (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
         $2, $3, 'INR', TRUE
       ) RETURNING *`,
      [provider_id, finalPrice, discountPerc]
    );

    const newService = insertServiceRes.rows[0];

    // Insert subservices
    if (Array.isArray(subservice_ids) && subservice_ids.length > 0) {
      for (const subId of subservice_ids) {
        await pool.query(
          `INSERT INTO provider.provider_service_subservices (
             provider_service_id, subservice_id
           ) VALUES (
             $1, (SELECT id FROM catalog.subservices WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1)
           ) ON CONFLICT DO NOTHING`,
          [newService.id, subId]
        );
      }
    }

    // Insert locations
    if (Array.isArray(location_ids) && location_ids.length > 0) {
      for (const locId of location_ids) {
        await pool.query(
          `INSERT INTO provider.provider_service_locations (
             provider_service_id, location_id, is_active
           ) VALUES (
             $1, (SELECT id FROM auth.locations WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1), TRUE
           ) ON CONFLICT DO NOTHING`,
          [newService.id, locId]
        );
      }
    }

    // Insert documents
    for (const doc of processedDocs) {
      await pool.query(
        `INSERT INTO provider.provider_service_documents (
           provider_service_id, document_type, document_url, public_id, status
         ) VALUES ($1, $2, $3, $4, 'pending')`,
        [newService.id, doc.document_type || 'service_doc', doc.file_url, doc.public_id || null]
      );
    }

    res.status(201).json({
      _id: newService.id,
      id: newService.id,
      provider_id,
      experience,
      price: Number(newService.price),
      discount: Number(newService.discount_percentage),
      final_price: finalPrice,
      location_ids: location_ids || [],
      subservice_ids: subservice_ids || [],
      documents: processedDocs,
      is_featured: is_featured || false,
      is_available: is_available ?? true,
      is_active: true
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all provider services (Admin)
// @route   GET /api/provider-services
// @access  Private/Admin
export const getAllProviderServices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const pool = getDb();

    const [servicesRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ps.*,
           COALESCE(array_agg(pss.subservice_id::text) FILTER (WHERE pss.subservice_id IS NOT NULL), '{}') AS subservice_ids
         FROM provider.provider_services ps
         LEFT JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
         WHERE ps.is_active = TRUE
         GROUP BY ps.id
         ORDER BY ps.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query(`SELECT COUNT(*) FROM provider.provider_services WHERE is_active = TRUE`)
    ]);

    const total = Number(countRes.rows[0]?.count) || 0;
    const providerIds = [...new Set(servicesRes.rows.map(s => String(s.provider_id)))];
    const providers = await ProviderRepository.findByIds(providerIds);
    const providerMap = new Map(providers.map(p => [String(p.id), p]));

    const userIds = [...new Set(providers.map(p => p.user_id).filter(Boolean))];
    const users = userIds.length > 0 ? await getUsersBatch(userIds) : [];
    const userMap = new Map<string, ResolvedUser>(users.map((u: any) => [String(u._id), u as ResolvedUser]));

    const result = servicesRes.rows.map(s => {
      const provider = providerMap.get(String(s.provider_id));
      const user = provider ? userMap.get(String(provider.user_id)) : null;
      return {
        _id: s.id,
        id: s.id,
        provider_id: provider ? {
          ...provider,
          user_id: user ?? provider.user_id
        } : s.provider_id,
        price: Number(s.price),
        discount: Number(s.discount_percentage),
        final_price: Number(s.price),
        subservice_ids: s.subservice_ids || [],
        is_active: s.is_active,
        created_at: s.created_at,
        updated_at: s.updated_at
      };
    });

    res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get services of a provider
// @route   GET /api/provider-services/:providerId
// @access  Public
export const getProviderServices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { providerId } = req.params;
    if (!providerId) {
      res.json({ data: [], total: 0, page: 1, limit: 50, pages: 0 });
      return;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const activeOnly = req.query.active_only === 'true';
    const pool = getDb();

    const activeFilter = activeOnly ? 'AND ps.is_active = TRUE' : '';

    const [servicesRes, countRes] = await Promise.all([
      pool.query(
        `SELECT ps.*,
           COALESCE(array_agg(DISTINCT pss.subservice_id::text) FILTER (WHERE pss.subservice_id IS NOT NULL), '{}') AS subservice_ids,
           COALESCE(array_agg(DISTINCT psl.location_id::text) FILTER (WHERE psl.location_id IS NOT NULL), '{}') AS location_ids
         FROM provider.provider_services ps
         LEFT JOIN provider.provider_service_subservices pss ON pss.provider_service_id = ps.id
         LEFT JOIN provider.provider_service_locations psl ON psl.provider_service_id = ps.id
         WHERE (ps.provider_id::text = $1 OR ps.provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
           ${activeFilter}
         GROUP BY ps.id
         ORDER BY ps.created_at DESC
         LIMIT $2 OFFSET $3`,
        [providerId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*) FROM provider.provider_services ps
         WHERE (ps.provider_id::text = $1 OR ps.provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
           ${activeFilter}`,
        [providerId]
      )
    ]);

    const total = Number(countRes.rows[0]?.count) || 0;
    const services = servicesRes.rows;

    const subserviceIds = [...new Set(services.flatMap(s => s.subservice_ids || []))];
    const catalogData = subserviceIds.length > 0 ? await getCatalogBatch(subserviceIds, [], [], []) : { subservices: [] };
    const subserviceMap = new Map<string, ResolvedSubService>((catalogData?.subservices || []).map((s: any) => [String(s._id || s.id), s as ResolvedSubService]));

    let allLocationIds = [...new Set(services.flatMap(s => s.location_ids || []))];
    let locationMap = new Map<string, any>();
    if (allLocationIds.length > 0) {
      try {
        const locations = await getLocationsBatch(allLocationIds);
        if (Array.isArray(locations)) {
          locationMap = new Map(locations.map((l: any) => [String(l._id || l.id), l]));
        }
      } catch (locErr) {
        console.warn('[PROVIDER-SERVICE] Failed to batch get locations:', locErr);
      }
    }

    const result = services.map(s => {
      const rawSubList: string[] = s.subservice_ids || [];
      const rawLocList: string[] = s.location_ids || [];

      return {
        _id: s.id,
        id: s.id,
        provider_id: s.provider_id,
        price: Number(s.price),
        discount: Number(s.discount_percentage),
        final_price: Number(s.price),
        is_active: Boolean(s.is_active),
        is_available: Boolean(s.is_active),
        experience: Number(s.experience) || 3,
        is_featured: Boolean(s.is_featured),
        subservice_ids: rawSubList.map(id => {
          return subserviceMap.get(id) || { _id: id, id, subservice_name: '—' };
        }),
        location_ids: rawLocList.map(id => {
          const found = locationMap.get(id);
          if (found) {
            return {
              _id: found._id || found.id,
              id: found.id || found._id,
              name: found.name || found.area_name || found.location_name || found.city || 'Area',
              type: found.type || 'sub_area',
              pincode: found.pincode || '',
              city: found.city || (typeof found.parent_id === 'object' ? found.parent_id?.name : undefined)
            };
          }
          return { _id: id, id, name: 'Area', type: 'sub_area' };
        })
      };
    });

    res.json({ data: result, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('[PROVIDER-SERVICE] getProviderServices error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider service
// @route   PUT /api/provider-services/:id
// @access  Private/Provider
export const updateProviderService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      price,
      discount,
      final_price,
      subservice_ids,
      is_active,
      is_available,
      is_featured
    } = req.body;

    const pool = getDb();
    const serviceRes = await pool.query(
      `SELECT * FROM provider.provider_services WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1`,
      [req.params.id]
    );

    if (serviceRes.rowCount === 0) {
      res.status(404).json({ message: 'Provider service not found' });
      return;
    }

    const current = serviceRes.rows[0];
    const newPrice = final_price !== undefined ? Number(final_price) : (price !== undefined ? Number(price) : Number(current.price));
    const newDiscount = discount !== undefined ? Number(discount) : Number(current.discount_percentage);
    const newActive = is_active !== undefined ? Boolean(is_active) : (is_available !== undefined ? Boolean(is_available) : current.is_active);

    const updatedRes = await pool.query(
      `UPDATE provider.provider_services
       SET price = $1, discount_percentage = $2, is_active = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newPrice, newDiscount, newActive, current.id]
    );

    if (Array.isArray(subservice_ids)) {
      await pool.query(`DELETE FROM provider.provider_service_subservices WHERE provider_service_id = $1`, [current.id]);
      for (const subId of subservice_ids) {
        await pool.query(
          `INSERT INTO provider.provider_service_subservices (
             provider_service_id, subservice_id
           ) VALUES (
             $1, (SELECT id FROM catalog.subservices WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1)
           ) ON CONFLICT DO NOTHING`,
          [current.id, subId]
        );
      }
    }

    res.json({
      _id: updatedRes.rows[0].id,
      id: updatedRes.rows[0].id,
      ...updatedRes.rows[0],
      price: Number(updatedRes.rows[0].price),
      discount: Number(updatedRes.rows[0].discount_percentage)
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Remove service from provider profile
// @route   DELETE /api/provider-services/:id
// @access  Private/Provider
export const deleteProviderService = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const pool = getDb();
    const result = await pool.query(
      `UPDATE provider.provider_services
       SET is_active = FALSE, updated_at = NOW()
       WHERE id::text = $1 OR legacy_mongo_id = $1`,
      [req.params.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: 'Provider service not found' });
      return;
    }

    res.json({ message: 'Service removed from provider' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update provider service location status / schedule / capacity (My Service Areas)
// @route   PUT /api/provider-services/locations/manage
// @access  Private/Provider/Admin
export const updateServiceLocationStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      provider_id,
      location_id,
      status,
      paused_reason,
      schedules,
      capacity,
      correlation_id
    } = req.body;

    if (!provider_id || !location_id || !status) {
      res.status(400).json({ message: 'provider_id, location_id, and status are required.' });
      return;
    }

    const pool = getDb();
    const servicesRes = await pool.query(
      `SELECT id FROM provider.provider_services
       WHERE (provider_id::text = $1 OR provider_id IN (SELECT id FROM provider.providers WHERE legacy_mongo_id = $1))
         AND is_active = TRUE`,
      [provider_id]
    );

    if (servicesRes.rowCount === 0) {
      res.status(404).json({ message: 'No service records found for provider' });
      return;
    }

    const isActive = status === 'active';

    for (const row of servicesRes.rows) {
      await pool.query(
        `INSERT INTO provider.provider_service_locations (
           provider_service_id, location_id, schedules, capacity, is_active, updated_at
         ) VALUES (
           $1,
           (SELECT id FROM auth.locations WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           $3, $4, $5, NOW()
         )
         ON CONFLICT (provider_service_id, location_id) DO UPDATE SET
           schedules = EXCLUDED.schedules,
           capacity = EXCLUDED.capacity,
           is_active = EXCLUDED.is_active,
           updated_at = NOW()`,
        [row.id, location_id, JSON.stringify(schedules || []), JSON.stringify(capacity || {}), isActive]
      );

      // Record audit log
      await pool.query(
        `INSERT INTO provider.location_audit_logs (
           provider_id, action, old_value, new_value, performed_by
         ) VALUES (
           (SELECT id FROM provider.providers WHERE id::text = $1 OR legacy_mongo_id = $1 LIMIT 1),
           $2, $3, $4,
           (SELECT id FROM auth.users WHERE id::text = $5 OR legacy_mongo_id = $5 LIMIT 1)
         )`,
        [
          provider_id,
          isActive ? 'LOCATION_ENABLED' : (status === 'paused' ? 'LOCATION_PAUSED' : 'LOCATION_SUSPENDED'),
          JSON.stringify({ reason: paused_reason || 'Provider toggle' }),
          JSON.stringify({ status, schedules, capacity }),
          req.user?._id
        ]
      ).catch(() => {});
    }

    res.json({ success: true, message: 'Service location updated successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Submit location change request (Provider)
// @route   POST /api/provider-services/locations/request-change
// @access  Private/Provider
export const requestLocationChange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { current_location_id, current_location_name, requested_location_id, requested_location_name, reason } = req.body;

    if (!requested_location_id || !reason) {
      res.status(400).json({ message: 'Requested location and reason are required.' });
      return;
    }

    const provider = await ProviderRepository.findByUserId(req.user?._id || '');
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found.' });
      return;
    }

    const pool = getDb();
    const existingPending = await pool.query(
      `SELECT id FROM provider.location_change_requests
       WHERE provider_id = $1 AND status = 'pending'
       LIMIT 1`,
      [provider.id]
    );

    if (existingPending.rowCount && existingPending.rowCount > 0) {
      res.status(400).json({ message: 'You already have a relocation request pending admin approval.' });
      return;
    }

    const insertRes = await pool.query(
      `INSERT INTO provider.location_change_requests (
         provider_id, old_location, new_location, status
       ) VALUES (
         $1, $2, $3, 'pending'
       ) RETURNING *`,
      [
        provider.id,
        JSON.stringify({ id: current_location_id, name: current_location_name || 'Current Location' }),
        JSON.stringify({ id: requested_location_id, name: requested_location_name || 'Requested Location', reason })
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Relocation request submitted for admin review.',
      data: insertRes.rows[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get current provider's relocation request
// @route   GET /api/provider-services/locations/my-change-request
// @access  Private/Provider
export const getMyLocationChangeRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const provider = await ProviderRepository.findByUserId(req.user?._id || '');
    if (!provider) {
      res.status(404).json({ message: 'Provider profile not found.' });
      return;
    }

    const pool = getDb();
    const resRow = await pool.query(
      `SELECT * FROM provider.location_change_requests
       WHERE provider_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [provider.id]
    );

    res.json({ success: true, data: resRow.rows[0] || null });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all relocation requests (Admin)
// @route   GET /api/providers/admin/location-change-requests
// @access  Private/Admin
export const getAdminLocationChangeRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const pool = getDb();
    const resRows = await pool.query(
      `SELECT r.*, p.user_id, p.kyc_status, p.availability_status
       FROM provider.location_change_requests r
       JOIN provider.providers p ON p.id = r.provider_id
       ORDER BY r.created_at DESC`
    );

    const userIds = resRows.rows.map(r => String(r.user_id)).filter(Boolean);
    const users = userIds.length > 0 ? await getUsersBatch(userIds) : [];
    const userMap = new Map(users.map((u: any) => [String(u._id), u]));

    const enriched = resRows.rows.map(r => ({
      ...r,
      provider_name: userMap.get(String(r.user_id))?.name || 'Provider',
      provider_phone: userMap.get(String(r.user_id))?.phone || '—'
    }));

    res.json({ success: true, data: enriched });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Review relocation request (Admin Approve/Reject)
// @route   PUT /api/providers/admin/location-change-requests/:id/review
// @access  Private/Admin
export const reviewLocationChangeRequest = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, admin_comment } = req.body;

    if (!action || !['approved', 'rejected'].includes(action)) {
      res.status(400).json({ message: 'Valid action (approved or rejected) is required.' });
      return;
    }

    const pool = getDb();
    const reqRes = await pool.query(
      `SELECT * FROM provider.location_change_requests WHERE id::text = $1 LIMIT 1`,
      [id]
    );

    if (reqRes.rowCount === 0) {
      res.status(404).json({ message: 'Relocation request not found.' });
      return;
    }

    const request = reqRes.rows[0];
    if (request.status !== 'pending') {
      res.status(400).json({ message: `Request is already ${request.status}.` });
      return;
    }

    const adminUserId = req.user?._id;
    const updateRes = await pool.query(
      `UPDATE provider.location_change_requests
       SET status = $1,
           reviewed_by = (SELECT id FROM auth.users WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [action, adminUserId, request.id]
    );

    if (action === 'approved') {
      const newLoc = request.new_location;
      const newLocId = newLoc?.id;

      if (newLocId) {
        // Link to provider service locations
        const services = await pool.query(
          `SELECT id FROM provider.provider_services WHERE provider_id = $1 AND is_active = TRUE`,
          [request.provider_id]
        );

        for (const s of services.rows) {
          await pool.query(
            `INSERT INTO provider.provider_service_locations (
               provider_service_id, location_id, is_active
             ) VALUES (
               $1, (SELECT id FROM auth.locations WHERE id::text = $2 OR legacy_mongo_id = $2 LIMIT 1), TRUE
             ) ON CONFLICT DO NOTHING`,
            [s.id, newLocId]
          );
        }

        // Audit log
        await pool.query(
          `INSERT INTO provider.location_audit_logs (
             provider_id, action, old_value, new_value, performed_by
           ) VALUES (
             $1, 'RELOCATION_APPROVED', $2, $3,
             (SELECT id FROM auth.users WHERE id::text = $4 OR legacy_mongo_id = $4 LIMIT 1)
           )`,
          [
            request.provider_id,
            JSON.stringify(request.old_location || {}),
            JSON.stringify(newLoc || {}),
            adminUserId
          ]
        ).catch(() => {});
      }
    }

    res.json({ success: true, message: `Relocation request ${action} successfully.`, data: updateRes.rows[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
