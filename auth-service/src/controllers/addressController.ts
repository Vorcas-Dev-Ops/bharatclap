import { Request, Response } from 'express';
import { AddressRepository } from '../repositories/addressRepository';
import { AuthRequest } from '../middleware/authMiddleware';

const formatAddressResponse = (addr: any) => {
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
    id: String(addr.id || addr._id)
  };
};

// @desc    Get user addresses
// @route   GET /api/address
// @access  Private
export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const addresses = await AddressRepository.findByUserId(userId);

    // Auto-assign default if none set
    if (addresses.length > 0 && !addresses.some(a => a.is_default)) {
      addresses[0].is_default = true;
      AddressRepository.setDefault(addresses[0].id, userId).catch((err: any) => {
        console.error(`[ADDRESS_ERROR] Failed to auto-set default address ${addresses[0].id} for user ${userId}:`, err?.message);
      });
    }

    res.json(addresses.map(formatAddressResponse));
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
    const addresses = await AddressRepository.findByIds(ids);
    res.json(addresses.map(formatAddressResponse));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new address
// @route   POST /api/address
// @access  Private
export const addAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

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
      formatted_address,
      is_default,
    } = req.body;

    if (!house_no_building || !address_line_1 || !area_locality || !city || !district || !state || !country || !pincode || latitude === undefined || longitude === undefined || !formatted_address) {
      res.status(400).json({ message: 'Required address fields or map coordinates are missing.' });
      return;
    }

    // Enforce 5-address limit per user
    const existingCount = await AddressRepository.countByUserId(userId);
    if (existingCount >= 5) {
      res.status(400).json({ message: 'You can save a maximum of 5 addresses. Please delete one before adding a new address.' });
      return;
    }

    // First address is always default
    const shouldBeDefault = existingCount === 0 ? true : !!is_default;

    const address = await AddressRepository.create({
      userId,
      addressType: address_type,
      label,
      houseNoBuilding: house_no_building,
      addressLine1: address_line_1,
      addressLine2: address_line_2,
      areaLocality: area_locality,
      landmark,
      city,
      district,
      state,
      country,
      pincode,
      deliveryNotes: delivery_notes,
      latitude: Number(latitude),
      longitude: Number(longitude),
      formattedAddress: formatted_address,
      isDefault: shouldBeDefault,
    });

    res.status(201).json(formatAddressResponse(address));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update address
// @route   PUT /api/address/:id
// @access  Private
export const updateAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const targetAddress = await AddressRepository.findById(req.params.id, userId);
    if (!targetAddress) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    const updated = await AddressRepository.update(req.params.id, userId, req.body);
    if (!updated) {
      res.status(404).json({ message: 'Address not found or update failed' });
      return;
    }

    res.json(formatAddressResponse(updated));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Set address as default
// @route   PATCH /api/address/:id/set-default
// @access  Private
export const setDefaultAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    await AddressRepository.setDefault(req.params.id, userId);
    const updated = await AddressRepository.findById(req.params.id, userId);
    if (!updated) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    res.json(formatAddressResponse(updated));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete address
// @route   DELETE /api/address/:id
// @access  Private
export const deleteAddress = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) {
      res.status(401).json({ message: 'Not authorized' });
      return;
    }

    const address = await AddressRepository.findById(req.params.id, userId);
    if (!address) {
      res.status(404).json({ message: 'Address not found' });
      return;
    }

    const wasDefault = address.is_default;
    await AddressRepository.softDelete(req.params.id, userId);

    // Promote the next address to default if needed
    if (wasDefault) {
      const remaining = await AddressRepository.findByUserId(userId);
      if (remaining.length > 0) {
        await AddressRepository.setDefault(remaining[0].id, userId);
      }
    }

    res.json({ message: 'Address removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
