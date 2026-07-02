// ============================================
// GOOGLE DRIVE API HANDLER
// ============================================

class GoogleDriveAPI {
    constructor() {
        this.isInitialized = false;
        this.accessToken = null;
    }

    // Initialize Google API
    async init() {
        try {
            await gapi.client.init({
                apiKey: CONFIG.API_KEY,
                clientId: CONFIG.CLIENT_ID,
                scope: CONFIG.SCOPES,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
            });

            this.isInitialized = true;
            console.log('Google Drive API initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Google Drive API:', error);
            throw error;
        }
    }

    // Get files from a specific folder
    async getFiles(folderId, fileTypes = ['.xlsx', '.xls']) {
        try {
            const query = `'${folderId}' in parents and trashed = false`;
            const response = await gapi.client.drive.files.list({
                q: query,
                fields: 'files(id, name, mimeType, modifiedTime, createdTime)',
                orderBy: 'name'
            });

            let files = response.result.files || [];

            // Filter by file type if specified
            if (fileTypes.length > 0) {
                files = files.filter(f =>
                    fileTypes.some(type => f.name.toLowerCase().endsWith(type))
                );
            }

            return files;
        } catch (error) {
            console.error('Error getting files from folder:', error);
            throw error;
        }
    }

    // Download and parse Excel file
    async downloadExcel(fileId) {
        try {
            const response = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const blob = new Blob([new Uint8Array(response.body)], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });

            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        const json = XLSX.utils.sheet_to_json(sheet);
                        resolve(json);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });
        } catch (error) {
            console.error('Error downloading file:', error);
            throw error;
        }
    }

    // Check if API is ready
    isReady() {
        return this.isInitialized;
    }
}

// Create singleton instance
const driveAPI = new GoogleDriveAPI();