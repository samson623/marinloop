async function test() {
    const url = 'https://lcbdafnxwvqbziootvmi.supabase.co/functions/v1/send-push';

    // We need a user JWT. Or we can just do a GET request using the ANON KEY.
    const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjYmRhZm54d3ZxYnppb290dm1pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMDI2OTMsImV4cCI6MjA4NjY3ODY5M30.CPBap3oAg7SERcINZtj6YwqiBq9AZrjmaZlRpwexbTQ';

    // Test health check
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        }
    });

    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Body:', text);
}

test().catch(console.error);
