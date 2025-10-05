# FeetOnFocus Inventory Management System

## Project Overview
Private inventory management application for SimpleBlu inventory management, designed to streamline stock updates from multiple suppliers (Temu, Transpharm, Medis).

## Requirements
- **Platform**: Windows desktop application
- **Cost**: Free (no subscriptions)
- **Usage**: Private use only
- **Primary Function**: Upload invoices, recognize items, match with database, approve updates

## Three-Phase Development Plan

### Phase 1: Database & Item Management
- Create local database for item storage
- Support for item pictures
- Manual item addition (one-by-one and bulk)
- Match SimpleBlu template structure
- Additional fields: supplier, seller, listing name, alternative names

### Phase 2: Invoice Processing & Stock Management
- Process purchase invoices (stock in)
- Process sale invoices (stock out)
- Calculate total stock value
- Export to Excel format for SimpleBlu updates
- Automatic item recognition and matching

### Phase 3: Cloud Integration
- Move database to Google Cloud
- Online synchronization capabilities

## Recommended Tech Stack (Free Options)

### Option 1: Web-Based Desktop App (Recommended - No Installation Required)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Database**: IndexedDB (browser-based, offline)
- **UI Framework**: Bootstrap or vanilla CSS
- **File Handling**: File API for image uploads and invoice processing
- **Excel Export**: SheetJS library (free)
- **Packaging**: Electron (optional, for true desktop app feel)

### Option 2: .NET Desktop App (Requires .NET Installation)
- **Frontend**: WPF with C#
- **Database**: SQLite
- **Framework**: .NET 8 (free)
- **Excel Processing**: EPPlus (free for non-commercial)

### Option 3: Python Desktop App (Requires Python Installation)
- **Frontend**: Tkinter or PyQt
- **Database**: SQLite
- **Excel Processing**: pandas + openpyxl
- **Image Handling**: Pillow

## Database Schema (Based on SimpleBlu Template)
Will need to analyze the Excel template to determine exact fields, but likely includes:
- Product ID/SKU
- Product Name
- Description
- Category
- Price
- Stock Quantity
- Supplier Information
- Images
- Alternative Names/Listings

## File Structure
```
FeetOnFocus/
├── Templates/
│   └── SimplyBlue bulk-product-template.xlsx
├── src/
│   ├── database/
│   ├── ui/
│   ├── utils/
│   └── main.js
├── assets/
│   ├── images/
│   └── styles/
└── docs/
```

## Next Steps
1. Analyze SimpleBlu template structure
2. Choose and install development environment
3. Create basic project structure
4. Design database schema
5. Implement Phase 1 features