import { Request, Response } from 'express';
import { Address } from '../models/Address';
import { AuthRequest } from '../middleware/authMiddleware';
import { getCoordinatesFromPincode } from '../utils/geocoding';

// Helper: build coordinates from lat/lng
const buildCoordinates = (lat: number, lng: number) => ({
  type: 'Point' as const,
  coordinates: [lng, lat] as [number, number],
});

// @desc    Get user addresses
// @route   GET /api/address
// @access  Private
export const getAddresses = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let addresses = await Address.find({ user_id: req.user?._id }).sort({ is_default: -1, createdAt: -1 });

    // Auto-assign default if none set
    if (addresses.length > 0 && !addresses.some(a => a.is_default)) {
      addresses[0].is_default = true;
      await addresses[0].save();
      addresses = await Address.find({ user_id: req.user?._id }).sort({ is_default: -1, createdAt: -1 });
    }

    res.json(addresses);
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
    res.json(addresses);
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
      address_label = 'Home',
      house_name,
      building_name,
      street,
      landmark,
      area,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
    } = req.body;

    if (!house_name || !area || !city || !state || !pincode) {
      res.status(400).json({ message: 'house_name, area, city, state and pincode are required.' });
      return;
    }

    // Unset current default if this one is being set as default
    if (is_default) {
      await Address.updateMany({ user_id: req.user?._id }, { is_default: false });
    }

    // Resolve coordinates
    let lat = latitude ? parseFloat(latitude) : undefined;
    let lng = longitude ? parseFloat(longitude) : undefined;

    if ((!lat || !lng) && pincode) {
      const geo = await getCoordinatesFromPincode(pincode);
      if (geo) { lat = geo.lat; lng = geo.lng; }
    }

    const coordinates = (lat && lng) ? buildCoordinates(lat, lng) : undefined;

    // First address is always default
    const existingCount = await Address.countDocuments({ user_id: req.user?._id });
    const shouldBeDefault = existingCount === 0 ? true : !!is_default;

    const address = await Address.create({
      user_id: req.user?._id,
      address_label,
      house_name,
      building_name,
      street,
      landmark,
      area,
      city,
      state,
      pincode,
      latitude: lat,
      longitude: lng,
      coordinates,
      is_default: shouldBeDefault,
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
      address_label,
      house_name,
      building_name,
      street,
      landmark,
      area,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
    } = req.body;

    if (is_default && !address.is_default) {
      await Address.updateMany({ user_id: req.user?._id }, { is_default: false });
    }

    // Resolve coordinates
    let lat = latitude !== undefined ? parseFloat(latitude) : address.latitude;
    let lng = longitude !== undefined ? parseFloat(longitude) : address.longitude;

    // Re-geocode if pincode changed and no explicit coords provided
    if (pincode && pincode !== address.pincode && latitude === undefined && longitude === undefined) {
      const geo = await getCoordinatesFromPincode(pincode);
      if (geo) { lat = geo.lat; lng = geo.lng; }
    }

    const coordinates = (lat && lng) ? buildCoordinates(lat, lng) : address.coordinates;

    address.address_label = address_label ?? address.address_label;
    address.house_name    = house_name    ?? address.house_name;
    address.building_name = building_name !== undefined ? building_name : address.building_name;
    address.street        = street        !== undefined ? street        : address.street;
    address.landmark      = landmark      !== undefined ? landmark      : address.landmark;
    address.area          = area          ?? address.area;
    address.city          = city          ?? address.city;
    address.state         = state         ?? address.state;
    address.pincode       = pincode       ?? address.pincode;
    address.latitude      = lat;
    address.longitude     = lng;
    address.coordinates   = coordinates;
    address.is_default    = is_default    ?? address.is_default;

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
