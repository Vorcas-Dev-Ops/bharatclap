-- Migration 015: Ensure provider_services have experience column and link subservices/locations
ALTER TABLE provider.provider_services
  ADD COLUMN IF NOT EXISTS experience INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;

-- Link existing demo provider services to subservices if unlinked
INSERT INTO provider.provider_service_subservices (provider_service_id, subservice_id)
VALUES
  ('b15c5564-393c-4285-b3f3-119896f8f414', '88c8cd5c-4f26-47d1-a5bf-52d75ad1efa0'),
  ('08fb0bbf-4e22-4ef9-9329-c6fcf2bd7ee1', '67f5be10-9fb6-448f-a1de-882ba667846a'),
  ('85d2a641-cc96-4d41-9d2b-a6a9a53390d5', '6d464165-9cf9-4beb-ba42-be7acabae964'),
  ('8368113e-00e1-4459-b81a-b4105fe729a8', '1c691206-aec9-445f-adc8-8d0ce73185f8')
ON CONFLICT (provider_service_id, subservice_id) DO NOTHING;

-- Link to provider's registered locations (Kammagondanahalli & Basavanagudi)
INSERT INTO provider.provider_service_locations (provider_service_id, location_id, is_active)
SELECT ps.id, l.id, TRUE
FROM provider.provider_services ps
CROSS JOIN (
  SELECT id FROM auth.locations WHERE name IN ('Kammagondanahalli', 'Basavanagudi')
) l
WHERE NOT EXISTS (
  SELECT 1 FROM provider.provider_service_locations psl 
  WHERE psl.provider_service_id = ps.id AND psl.location_id = l.id
);
