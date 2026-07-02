// Google Drive Integration
class GoogleDriveManager {
    constructor() {
        this.apiKey = CONFIG.GOOGLE_DRIVE.API_KEY;
        this.clientId = CONFIG.GOOGLE_DRIVE.CLIENT_ID;
        this.scopes = CONFIG.GOOGLE_DRIVE.SCOPES;
        this.discoveryDocs = CONFIG.GOOGLE_DRIVE.DISCOVERY_DOCS;
        this.tokenClient = null;
        this.isAuthenticated = false;
    }

    // Initialize Google Drive API
    init() {
        return new Promise((resolve, reject) => {
            try {
                gapi.load('client', () => {
                    gapi.client.init({
                        apiKey: this.apiKey,
                        discoveryDocs: this.discoveryDocs,
                    }).then(() => {
                        // Initialize OAuth
                        this.tokenClient = google.accounts.oauth2.initTokenClient({
                            client_id: this.clientId,
                            scope: this.scopes,
                            callback: (tokenResponse) => {
                                if (tokenResponse.error) {
                                    reject(tokenResponse.error);
                                    return;
                                }
                                this.isAuthenticated = true;
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
                    }).catch(reject);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // Authenticate user
    authenticate() {
        return new Promise((resolve, reject) => {
            if (this.isAuthenticated) {
                resolve();
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
            
            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${gapi.client.getToken().access_token}`,
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

// Initialize Google Drive Manager
const driveManager = new GoogleDriveManager();
