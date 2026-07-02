// js/gdrive.js
// Google Drive Integration

class GoogleDriveManager {
    constructor() {
        this.apiKey = CONFIG?.GOOGLE_DRIVE?.API_KEY || '';
        this.clientId = CONFIG?.GOOGLE_DRIVE?.CLIENT_ID || '';
        this.scopes = CONFIG?.GOOGLE_DRIVE?.SCOPES || 'https://www.googleapis.com/auth/drive.file';
        this.discoveryDocs = CONFIG?.GOOGLE_DRIVE?.DISCOVERY_DOCS || ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
        this.tokenClient = null;
        this.isAuthenticated = false;
        console.log('🔧 GoogleDriveManager initialized');
        console.log('🔧 Client ID configured:', this.clientId ? '✅ Yes' : '❌ No');
        console.log('🔧 API Key configured:', this.apiKey ? '✅ Yes' : '❌ No');
    }

    // Initialize Google Drive API
    init() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Initializing Google Drive...');
            
            // Check if gapi is loaded
            if (typeof gapi === 'undefined') {
                console.warn('⚠️ gapi not loaded yet, waiting...');
                const checkGapi = setInterval(() => {
                    if (typeof gapi !== 'undefined') {
                        clearInterval(checkGapi);
                        console.log('✅ gapi loaded, initializing...');
                        this.initGapi(resolve, reject);
                    }
                }, 200);
                setTimeout(() => {
                    clearInterval(checkGapi);
                    reject(new Error('Timeout loading Google API - gapi not loaded'));
                }, 15000);
                return;
            }
            
            // Check if google.accounts is loaded for OAuth
            if (typeof google === 'undefined' || typeof google.accounts === 'undefined') {
                console.warn('⚠️ google.accounts not loaded yet, waiting...');
                const checkGoogle = setInterval(() => {
                    if (typeof google !== 'undefined' && typeof google.accounts !== 'undefined') {
                        clearInterval(checkGoogle);
                        console.log('✅ google.accounts loaded, initializing...');
                        this.initGapi(resolve, reject);
                    }
                }, 200);
                setTimeout(() => {
                    clearInterval(checkGoogle);
                    reject(new Error('Timeout loading Google OAuth - google.accounts not loaded'));
                }, 15000);
                return;
            }
            
            this.initGapi(resolve, reject);
        });
    }

    initGapi(resolve, reject) {
        try {
            console.log('🔧 Initializing gapi client...');
            
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        apiKey: this.apiKey,
                        discoveryDocs: this.discoveryDocs,
                    });
                    console.log('✅ gapi client initialized');
                    
                    // Initialize OAuth
                    if (typeof google !== 'undefined' && google.accounts) {
                        console.log('🔧 Initializing OAuth token client...');
                        try {
                            this.tokenClient = google.accounts.oauth2.initTokenClient({
                                client_id: this.clientId,
                                scope: this.scopes,
                                callback: (tokenResponse) => {
                                    console.log('🔧 OAuth callback received');
                                    if (tokenResponse.error) {
                                        console.error('❌ OAuth error:', tokenResponse.error);
                                        reject(tokenResponse.error);
                                        return;
                                    }
                                    this.isAuthenticated = true;
                                    console.log('✅ Google Drive authenticated successfully');
                                    resolve();
                                },
                            });
                            console.log('✅ OAuth token client initialized');
                            
                            // Check if already authenticated
                            if (gapi.client.getToken()) {
                                this.isAuthenticated = true;
                                console.log('✅ Already authenticated');
                                resolve();
                            } else {
                                // Try to get token silently
                                console.log('🔧 Attempting silent authentication...');
                                try {
                                    this.tokenClient.requestAccessToken({
                                        prompt: 'none', // Try without user interaction first
                                    });
                                    // The callback will handle the rest
                                } catch (silentError) {
                                    console.warn('⚠️ Silent authentication failed, will prompt user when needed');
                                    // Continue without auth - will prompt when needed
                                    resolve();
                                }
                            }
                        } catch (oauthError) {
                            console.error('❌ OAuth initialization error:', oauthError);
                            // Continue without OAuth - will try again when needed
                            resolve();
                        }
                    } else {
                        console.warn('⚠️ Google OAuth not available');
                        resolve();
                    }
                } catch (gapiError) {
                    console.error('❌ gapi.client.init error:', gapiError);
                    reject(gapiError);
                }
            });
        } catch (error) {
            console.error('❌ initGapi error:', error);
            reject(error);
        }
    }

    // Authenticate user
    authenticate() {
        return new Promise((resolve, reject) => {
            console.log('🔧 Authenticating...');
            
            // Check if we already have a token
            try {
                const token = gapi.client.getToken();
                if (token) {
                    this.isAuthenticated = true;
                    console.log('✅ Already authenticated (token exists)');
                    resolve();
                    return;
                }
            } catch (e) {
                console.warn('⚠️ Could not check token:', e);
            }
            
            if (this.isAuthenticated) {
                console.log('✅ Already authenticated (flag)');
                resolve();
                return;
            }
            
            if (!this.tokenClient) {
                console.warn('⚠️ Token client not initialized, re-initializing...');
                // Try to re-initialize
                try {
                    if (typeof google !== 'undefined' && google.accounts) {
                        console.log('🔧 Re-initializing token client...');
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.clientId,
                            scope: this.scopes,
                            callback: (tokenResponse) => {
                                console.log('🔧 OAuth callback received');
                                if (tokenResponse.error) {
                                    console.error('❌ OAuth error:', tokenResponse.error);
                                    reject(tokenResponse.error);
                                    return;
                                }
                                this.isAuthenticated = true;
                                console.log('✅ Google Drive authenticated successfully');
                                resolve();
                            },
                        });
                        console.log('✅ Token client re-initialized');
                    } else {
                        reject(new Error('Google OAuth library not available'));
                        return;
                    }
                } catch (e) {
                    reject(new Error('Could not initialize OAuth: ' + e.message));
                    return;
                }
            }
            
            try {
                console.log('🔧 Requesting access token...');
                this.tokenClient.requestAccessToken({
                    prompt: 'consent', // Force consent to ensure we get a token
                });
                // The callback will handle the resolution
            } catch (error) {
                console.error('❌ Error requesting access token:', error);
                reject(error);
            }
        });
    }

    // List files in a folder
    async listFiles(folderId) {
    console.log('🔧 Listing files in folder:', folderId);
    try {
        await this.authenticate();
        console.log('✅ Authenticated, listing files...');
        
        const response = await gapi.client.drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'files(id, name, mimeType, modifiedTime, createdTime, parents)',
            orderBy: 'modifiedTime desc',
            supportsAllDrives: true,  // ← ADD THIS
            includeItemsFromAllDrives: true,  // ← ADD THIS
        });
        
        console.log(`✅ Found ${response.result.files.length} files in folder`);
        // Log file names for debugging
        response.result.files.forEach(f => console.log(`   📄 ${f.name} (${f.mimeType})`));
        return response.result.files;
    } catch (error) {
        console.error('❌ Error listing files:', error);
        throw error;
    }
}

    // js/gdrive.js - Replace the downloadFile method

async downloadFile(fileId) {
    try {
        await this.authenticate();
        
        // Use fetch with the Drive API to get binary data
        const token = gapi.client.getToken();
        if (!token) {
            throw new Error('No auth token available');
        }
        
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    'Authorization': `Bearer ${token.access_token}`,
                },
            }
        );
        
        if (!response.ok) {
            throw new Error(`Download failed: ${response.status} ${response.statusText}`);
        }
        
        // Get the data as ArrayBuffer
        const arrayBuffer = await response.arrayBuffer();
        console.log(`📥 Downloaded file ${fileId}, size: ${arrayBuffer.byteLength} bytes`);
        return arrayBuffer;
        
    } catch (error) {
        console.error('Error downloading file:', error);
        throw error;
    }
}

    // Upload file to Google Drive
    async uploadFile(folderId, file, name = null) {
        try {
            await this.authenticate();
            
            const metadata = {
                name: name || file.name,
                parents: [folderId],
            };
            
            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);
            
            const token = gapi.client.getToken();
            if (!token) {
                throw new Error('No auth token available');
            }
            
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token.access_token}`,
                },
                body: form,
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error uploading file:', error);
            throw error;
        }
    }

    // Delete file
    async deleteFile(fileId) {
        try {
            await this.authenticate();
            
            await gapi.client.drive.files.delete({
                fileId: fileId,
            });
            
            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            throw error;
        }
    }
}

// Create and expose the driveManager instance
const driveManager = new GoogleDriveManager();

// Make it available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.driveManager = driveManager;
}

// Export for module usage
export { driveManager, GoogleDriveManager };
