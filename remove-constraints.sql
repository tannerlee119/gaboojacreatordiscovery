-- Direct approach to remove the specific constraint causing the error
ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;

-- Also try these common constraint names
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey1;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS fk_profiles_id;

-- Check if there are any other foreign keys on the id column
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'profiles' 
        AND constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE 'ALTER TABLE profiles DROP CONSTRAINT ' || constraint_record.constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_record.constraint_name;
    END LOOP;
END $$;