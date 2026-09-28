SET local check_function_bodies = off;

ALTER TABLE "public"."profiles"
  DROP COLUMN "bio";

ALTER TABLE "public"."profiles"
  DROP COLUMN "location";

ALTER TABLE "public"."profiles"
  DROP COLUMN "phone_number";

ALTER TABLE "public"."profiles"
  ALTER COLUMN "id" DROP IDENTITY;

ALTER TABLE "public"."resumes"
  ALTER COLUMN "id" DROP IDENTITY;

ALTER TABLE "public"."profiles"
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "public"."profiles"
  ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "public"."profiles"
  ALTER COLUMN "first_name" DROP NOT NULL;

ALTER TABLE "public"."profiles"
  ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "public"."profiles"
  ALTER COLUMN "id" TYPE uuid
  USING (lpad(to_hex("id"), 32, '0')::uuid);

ALTER TABLE "public"."profiles"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."profiles"
  ALTER COLUMN "last_name" DROP NOT NULL;

ALTER TABLE "public"."resumes"
  ALTER COLUMN "created_at" SET NOT NULL;

ALTER TABLE "public"."resumes"
  ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "public"."resumes"
  ALTER COLUMN "id" TYPE uuid
  USING (lpad(to_hex("id"), 32, '0')::uuid);

ALTER TABLE "public"."resumes"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."resumes"
  ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "public"."profiles"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."resumes"
  ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "public"."resumes"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "public"."resumes"
  ALTER COLUMN "user_id" SET DEFAULT gen_random_uuid();

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

ALTER TABLE "public"."resumes"
  ADD CONSTRAINT "resumes_id_fkey" FOREIGN KEY (id) REFERENCES public.profiles(id);

CREATE POLICY "User can create their profile" ON "public"."profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "User can update thier profile" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = id))
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "Users can view their own profiles" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = id));

CREATE POLICY "User can delete their resume(s)" ON "public"."resumes"
  FOR DELETE
  TO "authenticator"
  USING ((auth.uid() = user_id));

CREATE POLICY "User can upload their own resumes" ON "public"."resumes"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "User cna view their resumes" ON "public"."resumes"
  FOR SELECT
  TO "authenticated"
  USING ((auth.uid() = user_id));

CREATE POLICY "Users can update their resumes" ON "public"."resumes"
  FOR UPDATE
  TO "authenticated"
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

COMMENT ON TABLE "public"."profiles" IS 'user profiles';

COMMENT ON TABLE "public"."resumes" IS 'user resumes';

