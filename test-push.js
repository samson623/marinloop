async function test() {
    const url = 'https://lcbdafnxwvqbziootvmi.supabase.co/functions/v1/send-push';

    // Anonymous JWT should no longer be able to hit GET diagnostics.
    const anonKey = 'REPLACE_WITH_ANON_OR_USER_JWT';

    // Verify non-POST methods are rejected.
    const getResponse = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        }
    });

    const getText = await getResponse.text();
    console.log('GET status (expected 405):', getResponse.status);
    console.log('GET body:', getText);

    // Example POST shape (will require a valid JWT/service role and payload values).
    const postResponse = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user_id: '00000000-0000-0000-0000-000000000000',
            title: 'Test title',
            body: 'Test body'
        })
    });

    const postText = await postResponse.text();
    console.log('POST status:', postResponse.status);
    console.log('POST body:', postText);
}

test().catch(console.error);
