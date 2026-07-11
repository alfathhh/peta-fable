-- Titik yang tidak cocok dengan polygon wilayah tidak boleh diklaim sebagai Kabupaten 1306.
ALTER TABLE infrastructures
  ALTER COLUMN idkab DROP NOT NULL;
