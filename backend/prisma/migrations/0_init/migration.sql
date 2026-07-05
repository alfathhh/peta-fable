-- PostGIS wajib tersedia (image dev: postgis/postgis:16-3.4)
CREATE EXTENSION IF NOT EXISTS postgis;

-- users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150),
    "password" TEXT NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- regions (5 level dalam satu tabel; geometry via PostGIS)
CREATE TABLE "regions" (
    "region_id" VARCHAR(16) NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "parent_id" VARCHAR(16),
    "geom" geometry(MultiPolygon,4326),
    "geom_simplified" geometry(MultiPolygon,4326),
    "bbox" JSONB,
    "properties" JSONB,
    "source_version" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "regions_pkey" PRIMARY KEY ("region_id")
);
CREATE INDEX "idx_regions_level" ON "regions"("level");
CREATE INDEX "idx_regions_prefix" ON "regions"("region_id" varchar_pattern_ops);
CREATE INDEX "idx_regions_geom" ON "regions" USING GIST("geom");
CREATE INDEX "idx_regions_name" ON "regions" USING GIN (to_tsvector('simple', "name"));

-- categories
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- activities
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- activity_tokens
CREATE TABLE "activity_tokens" (
    "id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "token" CHAR(7) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "max_claims" INTEGER,
    "claims_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activity_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_tokens_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activity_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "activity_tokens_token_key" ON "activity_tokens"("token");

-- activity_claims
CREATE TABLE "activity_claims" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_token_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "activity_claims_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "activity_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activity_claims_activity_token_id_fkey" FOREIGN KEY ("activity_token_id") REFERENCES "activity_tokens"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "activity_claims_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "activity_claims_user_id_activity_token_id_key" ON "activity_claims"("user_id", "activity_token_id");

-- projects
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "region_id" VARCHAR(16) NOT NULL,
    "region_level" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'aktif',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "projects_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- project_layers
CREATE TABLE "project_layers" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "geojson_path" TEXT NOT NULL,
    "feature_count" INTEGER NOT NULL DEFAULT 0,
    "style" JSONB NOT NULL,
    "is_visible" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_layers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "project_layers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- infrastructures
CREATE TABLE "infrastructures" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "category_id" TEXT NOT NULL,
    "description" TEXT,
    "geom" geometry(Point,4326),
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "gps_accuracy_m" DOUBLE PRECISION,
    "photo_path" TEXT,
    "idkab" VARCHAR(4) NOT NULL,
    "idkec" VARCHAR(7),
    "iddesa" VARCHAR(10),
    "idsls" VARCHAR(14),
    "idsubsls" VARCHAR(16),
    "is_outside_region" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "activity_id" TEXT,
    "source" VARCHAR(20) NOT NULL DEFAULT 'manual',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "infrastructures_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "infrastructures_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "infrastructures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "infrastructures_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "infrastructures_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "infrastructures_category_id_idx" ON "infrastructures"("category_id");
CREATE INDEX "infrastructures_idkec_idx" ON "infrastructures"("idkec");
CREATE INDEX "infrastructures_iddesa_idx" ON "infrastructures"("iddesa");
CREATE INDEX "infrastructures_idsls_idx" ON "infrastructures"("idsls");
CREATE INDEX "infrastructures_user_id_idx" ON "infrastructures"("user_id");
CREATE INDEX "infrastructures_is_outside_region_idx" ON "infrastructures"("is_outside_region");
CREATE INDEX "idx_infrastructures_geom" ON "infrastructures" USING GIST("geom");

-- region_uploads
CREATE TABLE "region_uploads" (
    "id" TEXT NOT NULL,
    "level" VARCHAR(10) NOT NULL,
    "filename" TEXT NOT NULL,
    "feature_count" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'processing',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "region_uploads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "region_uploads_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
