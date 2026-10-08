import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL + '/rest/v1/live_matches?id=not.like.*/*';
  console.log('Calling:', url);
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
      'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`
    }
  });
  
  console.log('Status:', res.status, res.statusText);
  if (!res.ok) {
    const text = await res.text();
    console.log('Error body:', text);
  }
}
run();
