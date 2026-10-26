SET local check_function_bodies = off;

DROP TRIGGER "on_auth_user_created" ON "auth"."users";

DROP TRIGGER "set_profiles_updated_at" ON "public"."profiles";

ALTER TABLE "public"."education"
  DROP CONSTRAINT "education_user_id_fkey";

ALTER TABLE "public"."profiles"
  DROP CONSTRAINT "profiles_id_fkey";

ALTER TABLE "public"."skills"
  DROP CONSTRAINT "skills_user_id_fkey";

ALTER TABLE "public"."work_experiences"
  DROP CONSTRAINT "work_experiences_user_id_fkey";

DROP FUNCTION "public"."handle_new_user"();

ALTER TABLE "public"."profiles"
  DROP COLUMN "avatar_url";

ALTER TABLE "public"."profiles"
  DROP COLUMN "bio";

ALTER TABLE "public"."profiles"
  DROP COLUMN "location";

ALTER TABLE "public"."profiles"
  DROP COLUMN "phone_number";

ALTER TABLE "public"."profiles"
  DROP COLUMN "title";

ALTER TABLE "public"."profiles"
  DROP COLUMN "updated_at";

DROP TABLE "public"."education";

DROP TABLE "public"."skills";

DROP TABLE "public"."work_experiences";

DROP FUNCTION "public"."set_updated_at"();

ALTER TABLE "public"."profiles"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

