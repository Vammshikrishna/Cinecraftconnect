// Run this script with: node generate-types.js
// This will fetch your database schema and generate TypeScript types

const { execSync } = require('child_process');
const fs = require('fs');

console.log('Generating Supabase TypeScript types...\n');

try {
    // Try using npx to generate types
    console.log('Attempting to generate types using npx...');
    const output = execSync('npx supabase gen types typescript --project-id hfkubpcdbjxhafulxhfv', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
    });

    // Write to file
    fs.writeFileSync('src/types/supabase.ts', output, 'utf8');
    console.log('✅ Successfully generated types to src/types/supabase.ts');
    console.log(`📝 Generated ${output.split('\n').length} lines of type definitions`);

} catch (error) {
    console.error('❌ Error generating types:', error.message);
    console.log('\n📋 Please try one of these alternatives:');
    console.log('1. Run: npx supabase login');
    console.log('2. Then run: npx supabase gen types typescript --project-id hfkubpcdbjxhafulxhfv > src/types/supabase.ts');
    console.log('\nOr visit the Supabase dashboard and copy the types manually from the API docs.');
    process.exit(1);
}
