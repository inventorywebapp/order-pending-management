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
    }

    // Initialize Google Drive API
    init() {
        return new Promise((resolve, reject) => {
            try {
                if (typeof gapi === 'undefined') {
                    console.warn('⚠️ gapi not loaded yet, waiting...');
                    // Wait for gapi to load
                    const checkGapi = setInterval(() => {
                        if (typeof gapi !== 'undefined') {
                            clearInterval(checkGapi);
                            this.initGapi(resolve, reject);
                        }
                    }, 100);
                    // Timeout after 10 seconds
                    setTimeout(() => {
                        clearInterval(checkGapi);
                        reject(new Error('Timeout loading Google API'));
                    }, 10000);
                    return;
                }
                this.initGapi(resolve, reject);
            } catch (error) {
                reject(error);
            }
        });
    }

    initGapi(resolve, reject) {
        try {
            gapi.load('client', () => {
                gapi.client.init({
                    apiKey: this.apiKey,
                    discoveryDocs: this.discoveryDocs,
                }).then(() => {
                    // Initialize OAuth
                    if (typeof google !== 'undefined' && google.accounts) {
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.clientId,
                            scope: this.scopes,
                            callback: (tokenResponse) => {
                                if (tokenResponse.error) {
                                    reject(tokenResponse.error);
                                    return;
                                }
                                this.isAuthenticated = true;
                                console.log('✅ Google Drive authenticated');
                                resolve();
                            },
                        });
                        
                        // Check if already authenticated
                        if (gapi.client.getToken()) {
                            this.isAuthenticated = true;
                            resolve();
                        } else {
                            resolve();
                        }
                    } else {
                        console.warn('⚠️ Google OAuth not available, attempting without auth');
                        resolve();
                    }
                }).catch(reject);
            });
        } catch (error) {
            reject(error);
        }
    }

    // Authenticate user
    authenticate() {
        return new Promise((resolve, reject) => {
            if (this.isAuthenticated) {
                resolve();
                return;
            }
            
            if (!this.tokenClient) {
                reject(new Error('Token client not initialized'));
                return;
            }
            
            this.tokenClient.requestAccessToken({
                prompt: 'consent',
            });
            
            // The callback will handle the resolution
            const originalCallback = this.tokenClient.callback;
            this.tokenClient.callback = (tokenResponse) => {
                if (tokenResponse.error) {
                    reject(tokenResponse.error);
                } else {
                    this.isAuthenticated = true;
                    resolve();
                }
                if (originalCallback) {
                    originalCallback(tokenResponse);
                }
            };
        });
    }

    // List files in a folder
    async listFiles(folderId) {
        try {
            await this.authenticate();
            
            const response = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed=false`,
                fields: 'files(id, name, mimeType, modifiedTime, createdTime)',
                orderBy: 'modifiedTime desc',
            });
            
            return response.result.files;
        } catch (error) {
            console.error('Error listing files:', error);
            throw error;
        }
    }

    // Download file content
    async downloadFile(fileId) {
        try {
            await this.authenticate();
            
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media',
            });
            
            return response.body;
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
