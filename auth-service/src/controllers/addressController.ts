import { Request, Response } from 'express';
import { Address } from '../models/Address';
import { AuthRequest } from '../middleware/authMiddleware';

// @desc    Get user addresses
// @route   GET /api/address
// @access  Private
export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;

    let addresses = await Address.find({ user_id: req.user?._id })
      .sort({ is_default: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Auto-assign default in-memory if none set, and update DB asynchronously
    if (addresses.length > 0 && !addresses.some(a => a.is_default)) {
      addresses[0].is_default = true;
      Address.findByIdAndUpdate(addresses[0]._id, { is_default: true }).catch((err: any) => {
        console.error(`[ADDRESS_ERROR] Failed to auto-set default address ${addresses[0]._id} for user ${req.user?._id}:`, err?.message);
      });
    }

    const mapAddressLine = (addr: any) => {
      const parts = [
        addr.house_no_building,
        addr.address_line_1,
        addr.address_line_2,
        addr.address_line_3,
        addr.area_locality,
        addr.city,
        addr.district,
        addr.state,
        `${addr.country || 'India'} - ${addr.pincode}`
      ].filter(Boolean);
      return {
        ...addr,
        address_line: parts.join(', '),
        short_address: [
          addr.address_line_1 || addr.house_no_building,
          addr.area_locality,
          addr.city
        ].filter(Boolean).join(', '),
        id: String(addr._id)
      };
    };

    res.json(addresses.map(mapAddressLine));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get multiple addresses by IDs (Internal API)
// @route   POST /api/address/batch
// @access  Internal
export const getAddressesBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      res.status(400).json({ message: 'Please provide an array of ids' });
      return;
    }
    const addresses = await Address.find({ _id: { $in: ids } }).lean();
    
    const mapAddressLine = (addr: any) => {
      const parts = [
        addr.house_no_building,
        addr.address_line_1,
        addr.address_line_2,
        addr.address_line_3,
        addr.area_locality,
        addr.city,
        addr.district,
        addr.state,
        `${addr.country || 'India'} - ${addr.pincode}`
      ].filter(Boolean);
      return {
        ...addr,
        address_line: parts.join(', '),
        short_address: [
          addr.address_line_1 || addr.house_no_building,
          addr.area_locality,
          addr.city
        ].filter(Boolean).join(', '),
        id: String(addr._id)
      };
    };

    res.json(addresses.map(mapAddressLine));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new address
// @route   POST /api/address
// @access  Private
export const addAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      address_type = 'Home',
      label,
      house_no_building,
      address_line_1,
      address_line_2,
      address_line_3,
      area_locality,
      landmark,
      city,
      district,
      state,
      country = 'India',
      pincode,
      delivery_notes,
      latitude,
      longitude,
      location,
      formatted_address,
      place_id,
      map_provider,
      is_verified,
      is_default,
    } = req.body;

    if (!house_no_building || !address_line_1 || !area_locality || !city || !district || !state || !country || !pincode || latitude === undefined || longitude === undefined || !formatted_address) {
      res.status(400).json({ message: 'Required address fields or map coordinates are missing.' });
      return;
    }

    // Enforce 5-address limit per user
    const existingCount = await Address.countDocuments({ user_id: req.user?._id });
    if (existingCount >= 5) {
      res.status(400).json({ message: 'You can save a maximum of 5 addresses. Please delete one before adding a new address.' });
      return;
    }

    // Unset current default if this one is being set as default
    if (is_default) {
      await Address.updateMany({ user_id: req.user?._id }, { is_default: false });
    }

    // First address is always default
    const shouldBeDefault = existingCount === 0 ? true : !!is_default;

    const address = await Address.create({
      user_id: req.user?._id,
      address_type,
      label,
      house_no_building,
      address_line_1,
      address_line_2,
      address_line_3,
      area_locality,
      landmark,
      city,
      district,
      state,
      country,
      pincode,
      delivery_notes,
      latitude,
      longitude,
      location,
      formatted_address,
      place_id,
      map_provider,
      is_verified,
      is_default: shouldBeDefault,
      status: true
    });

    res.status(201).json(address);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update address
// @route   PUT /api/address/:id
// @access  Private
export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user_id: req.user?._id });

    if (!address) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    const {
      address_type,
      label,
      house_no_building,
      address_line_1,
      address_line_2,
      address_line_3,
      area_locality,
      landmark,
      city,
      district,
      state,
      country,
      pincode,
      delivery_notes,
      latitude,
      longitude,
      location,
      formatted_address,
      place_id,
      map_provider,
      is_verified,
      is_default,
    } = req.body;

    if (is_default && !address.is_default) {
      await Address.updateMany({ user_id: req.user?._id }, { is_default: false });
    }

    address.address_type = address_type ?? address.address_type;
    address.label = label !== undefined ? label : address.label;
    address.house_no_building = house_no_building ?? address.house_no_building;
    address.address_line_1 = address_line_1 ?? address.address_line_1;
    address.address_line_2 = address_line_2 !== undefined ? address_line_2 : address.address_line_2;
    address.address_line_3 = address_line_3 !== undefined ? address_line_3 : address.address_line_3;
    address.area_locality = area_locality ?? address.area_locality;
    address.landmark = landmark !== undefined ? landmark : address.landmark;
    address.city = city ?? address.city;
    address.district = district ?? address.district;
    address.state = state ?? address.state;
    address.country = country ?? address.country;
    address.pincode = pincode ?? address.pincode;
    address.delivery_notes = delivery_notes !== undefined ? delivery_notes : address.delivery_notes;
    address.latitude = latitude ?? address.latitude;
    address.longitude = longitude ?? address.longitude;
    address.location = location ?? address.location;
    address.formatted_address = formatted_address ?? address.formatted_address;
    address.place_id = place_id !== undefined ? place_id : address.place_id;
    address.map_provider = map_provider !== undefined ? map_provider : address.map_provider;
    address.is_verified = is_verified ?? address.is_verified;
    address.is_default = is_default ?? address.is_default;

    const updated = await address.save();
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set address as default
// @route   PATCH /api/address/:id/set-default
// @access  Private
export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user_id: req.user?._id });
    if (!address) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }
    await Address.updateMany({ user_id: req.user?._id }, { is_default: false });
    address.is_default = true;
    await address.save();
    res.json(address);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete address
// @route   DELETE /api/address/:id
// @access  Private
export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const address = await Address.findOne({ _id: req.params.id, user_id: req.user?._id });
    if (!address) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    const wasDefault = address.is_default;
    await address.deleteOne();

    // Promote the next address to default
    if (wasDefault) {
      const next = await Address.findOne({ user_id: req.user?._id }).sort({ createdAt: -1 });
      if (next) { next.is_default = true; await next.save(); }
    }

    res.json({ message: 'Address removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
