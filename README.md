# Order Pending Management System

A modern web application for managing and tracking orders, deliveries, and pending items with Google Drive integration.

## Features

- 📊 **Dashboard**: Overview of total orders, deliveries, and pending items
- 📦 **Orders Management**: Track all orders with filtering and search
- 🚚 **Deliveries Tracking**: Monitor delivery status and quantities
- ✅ **Actual Received**: Track actual received items
- ⏰ **Pending Orders**: View and manage pending orders with detailed breakdown
- 📈 **Analysis**: Generate reports by supplier, SKU, or date
- 🔍 **Search & Filter**: Easy search and filter capabilities
- 📤 **Export**: Export data to CSV for reporting
- 📁 **Google Drive Integration**: Automatic file syncing with Google Drive
- 📱 **Responsive**: Works on desktop, tablet, and mobile

## Tech Stack

### Frontend
- HTML5, CSS3, JavaScript
- Google Drive API
- Font Awesome Icons
- Modern, responsive design

### Backend (Optional)
- Python Flask
- Pandas for Excel processing
- SQLite database

## Setup Instructions

### 1. Google Drive API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Drive API
4. Create OAuth 2.0 credentials
5. Download credentials and update `js/config.js`

### 2. Frontend Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/order-pending-management.git
# Deployment fix - trigger rebuild
