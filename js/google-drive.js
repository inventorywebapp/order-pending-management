// ============================================
// GOOGLE DRIVE API HANDLER
// ============================================

class GoogleDriveAPI {
    constructor() {
        this.isInitialized = false;
    }

    async init() {
        try {
            await gapi.client.init({
                apiKey: CONFIG.API_KEY,
                clientId: CONFIG.CLIENT_ID,
                scope: CONFIG.SCOPES,
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
            });
            this.isInitialized = true;
            console.log('✅ Google Drive API initialized');
            return true;
        } catch (error) {
            console.error('❌ Google Drive init error:', error);
            throw new Error('Failed to initialize Google Drive. Please check your API key and credentials.');
        }
    }

    async getFiles(folderId, extensions = ['.xlsx', '.xls']) {
        try {
            const res = await gapi.client.drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'name'
            });
            let files = res.result.files || [];
            if (extensions.length) {
                files = files.filter(f => extensions.some(ext => f.name.toLowerCase().endsWith(ext)));
            }
            return files;
        } catch (error) {
            console.error('Error fetching files:', error);
            throw new Error('Failed to fetch files from Google Drive.');
        }
    }

    async downloadExcel(fileId) {
        try {
            const res = await gapi.client.drive.files.get({ fileId, alt: 'media' });
            const blob = new Blob([new Uint8Array(res.body)], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = new Uint8Array(e.target.result);
                        const workbook = XLSX.read(data, { type: 'array' });
                        const sheet = workbook.Sheets[workbook.SheetNames[0]];
                        resolve(XLSX.utils.sheet_to_json(sheet));
                    } catch (err) { reject(err); }
                };
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });
        } catch (error) {
            console.error('Error downloading file:', error);
            throw new Error('Failed to download Excel file from Google Drive.');
        }
    }

    isReady() { return this.isInitialized; }
}

const driveAPI = new GoogleDriveAPI();
