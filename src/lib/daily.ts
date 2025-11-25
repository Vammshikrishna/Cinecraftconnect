// Helper function to create a Daily.co room
export const createDailyRoom = async (roomName: string): Promise<{ url: string; name: string } | null> => {
    const apiKey = import.meta.env.VITE_DAILY_API_KEY;
    const domain = import.meta.env.VITE_DAILY_DOMAIN || 'reelsphere.daily.co';

    console.log('Creating Daily.co room:', { roomName, hasApiKey: !!apiKey, domain });

    if (!apiKey) {
        console.warn('Daily.co API key not configured');
        // Throw a specific error that the UI can catch and display
        throw new Error('Daily.co API key is missing. Please configure VITE_DAILY_API_KEY in .env.local');
    }

    try {
        console.log('Calling Daily.co API...');
        const response = await fetch('https://api.daily.co/v1/rooms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                name: roomName,
                properties: {
                    enable_screenshare: true,
                    enable_chat: true,
                    enable_knocking: true,
                    enable_prejoin_ui: false,
                    max_participants: 50
                }
            })
        });

        console.log('Daily.co API response status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Daily.co API error:', response.status, errorText);
            throw new Error(`Daily.co API error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Daily.co room created successfully:', data.url);
        return {
            name: data.name,
            url: data.url
        };
    } catch (error) {
        console.error('Error creating Daily.co room:', error);
        throw error; // Re-throw to be caught by caller
    }
};
