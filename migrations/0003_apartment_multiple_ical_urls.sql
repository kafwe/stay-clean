ALTER TABLE apartments ADD COLUMN booking_ical_url TEXT;
ALTER TABLE apartments ADD COLUMN airbnb_ical_url TEXT;

UPDATE apartments
SET booking_ical_url = COALESCE(booking_ical_url, ical_url)
WHERE ical_url IS NOT NULL;
