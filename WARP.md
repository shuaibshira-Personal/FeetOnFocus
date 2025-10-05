# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

FeetOnFocus is a Windows desktop inventory management application designed to streamline stock management for SimpleBlu inventory. The app helps manage inventory from multiple suppliers (Temu, Transpharm, Medis) with features for item tracking, invoice processing, and export capabilities.

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **UI Framework**: Bootstrap 5.3.2
- **Icons**: Font Awesome 6.0
- **Database**: IndexedDB (browser-based, offline storage)
- **Excel Export**: SheetJS (XLSX library)
- **Architecture**: Modular JavaScript classes with separation of concerns

## Project Structure

```
FeetOnFocus/
├── index.html              # Main application entry point
├── Templates/              # Excel templates for reference
│   └── SimplyBlue bulk-product-template.xlsx
├── src/                    # Source code
│   ├── database/           # Database layer
│   │   └── database.js     # IndexedDB wrapper and operations
│   ├── ui/                 # User interface modules
│   │   ├── dashboard.js    # Dashboard statistics and activity
│   │   ├── items.js        # Item management functionality
│   │   ├── suppliers.js    # Supplier management functionality
│   │   └── reports.js      # Export and reporting features
│   ├── utils/              # Utility functions
│   │   └── helpers.js      # Common helper functions
│   └── main.js             # Main application controller
├── assets/                 # Static assets
│   ├── styles/
│   │   └── main.css        # Custom CSS styles
│   ├── logo/               # Company logos and branding
│   │   ├── FEET_LOGO round updated.jpg
│   │   └── LOGO_bag_black.jpg
│   └── images/             # Item images (stored locally)
└── docs/                   # Documentation
```

## Architecture Overview

### Database Layer (`src/database/database.js`)
- **InventoryDatabase class**: Manages IndexedDB operations
- **Object Stores**: items, invoices (Phase 2), activity logs
- **Operations**: CRUD operations, search, statistics, bulk import
- **Data Structure**: Items include name, SKU, category, price, quantity, supplier info, images

### UI Layer (`src/ui/`)
- **Dashboard**: Statistics cards, recent activity, overview metrics
- **Items Management**: Add/edit/delete items, search/filter, image uploads
- **Reports**: Excel export for SimpleBlu, full inventory exports
- **Modular Design**: Each UI component is a separate class

### Application Controller (`src/main.js`)
- **FeetOnFocusApp class**: Main application orchestrator
- **Tab Management**: Navigation between different sections
- **Error Handling**: Global error handling and user feedback
- **Initialization**: Database setup and module initialization

## Development Commands

### Running the Application
```bash
# Serve the application using any HTTP server
# Option 1: Using Python (if available)
python -m http.server 8000

# Option 2: Using Node.js live-server (if available)
npx live-server

# Option 3: Simply open index.html in a web browser
# Note: Some features may require HTTP server due to CORS policies
```

### Development Workflow
```bash
# 1. Make changes to source files
# 2. Refresh browser to see changes
# 3. Use browser Developer Tools (F12) for debugging
# 4. Check console for JavaScript errors
# 5. Use Application tab to inspect IndexedDB data
```

## Phase Development Plan

### Phase 1: ✅ Database & Item Management (Current)
- Local item database with IndexedDB
- Manual item addition with image support
- Item search and filtering
- Basic reporting and Excel export
- Statistics dashboard

### Phase 2: Invoice Processing (Future)
- Upload and process invoices from suppliers
- Automatic item recognition and matching
- Purchase/sale invoice management
- Stock level updates from invoices
- Enhanced reporting

### Phase 3: Cloud Integration (Future)
- Google Cloud integration
- Online database synchronization
- Multi-device access
- Enhanced backup and recovery

## Key Features

### Item Management
- Add items manually with comprehensive details
- Upload and store item images
- Track supplier information and alternative names
- Search by name, SKU, description, or alternative names
- Filter by supplier or category

### Dashboard
- Real-time statistics (total items, stock value, low stock alerts)
- Recent activity log
- Supplier and category summaries

### Export Capabilities
- Export for SimpleBlu (formatted for bulk import)
- Full inventory export with multiple sheets
- Low stock and supplier analysis reports

## Browser Requirements
- Modern web browser with IndexedDB support
- JavaScript enabled
- Local storage capability
- File API support for image uploads

## Data Storage
- **Database**: Browser's IndexedDB (persistent, offline)
- **Images**: Stored as base64 data URLs in database
- **Export Files**: Generated client-side, downloaded to user's system

## Development Guidelines
- Use ES6+ JavaScript features
- Maintain separation of concerns between modules
- Follow Bootstrap conventions for UI consistency
- Handle errors gracefully with user-friendly messages
- Ensure responsive design for different screen sizes

## Common Development Tasks

### Adding New Features
1. Create or modify relevant UI module in `src/ui/`
2. Update database schema if needed in `src/database/database.js`
3. Add helper functions to `src/utils/helpers.js` if needed
4. Update main application controller if required
5. Test thoroughly in browser

### Debugging
- Use browser Developer Tools (F12)
- Check Console for JavaScript errors
- Inspect Application > IndexedDB for database contents
- Use Network tab to check for resource loading issues

### Testing
- Test in different browsers (Chrome, Edge, Firefox)
- Verify IndexedDB functionality
- Test export functionality with generated Excel files
- Verify responsive design on different screen sizes

## Future Enhancements
- Barcode scanning for item identification
- Advanced search with filters
- Item categories management
- Bulk edit capabilities
- Import from CSV/Excel
- Advanced reporting and analytics
- Multi-language support
