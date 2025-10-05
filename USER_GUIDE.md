# FeetOnFocus User Guide

Welcome to FeetOnFocus, your comprehensive inventory management solution for podiatry practices!

## Getting Started

### 1. Launch the Application
- Open `index.html` in your web browser
- The application will automatically initialize and create a local database
- No internet connection required after initial load

### 2. Dashboard Overview
The dashboard provides a quick overview of your inventory:
- **Total Items**: Complete count of your inventory
- **Stock Value**: Total monetary value of current stock
- **Low Stock**: Items that need reordering (less than 5 units)
- **Suppliers**: Number of active suppliers
- **Recent Activity**: Latest changes and additions

## Managing Items

### Adding New Items
1. Click **"Add Item"** button in the Items tab
2. Fill in the item details:
   - **Required**: Item Name
   - **Optional**: SKU, Category, Price, Quantity
   - **Supplier Info**: Primary Supplier, Seller, Listing Name
   - **Alternative Names**: Different names for the same product (comma-separated)
   - **Description**: Detailed product information
   - **Image**: Upload a product photo

3. Click **"Save Item"** to add to your inventory

### Searching and Filtering
- **Search Bar**: Find items by name, SKU, description, or alternative names
- **Supplier Filter**: Show items from specific suppliers (Temu, Transpharm, Medis)
- **Real-time Results**: Search results update as you type

### Item Actions
- **👁️ View**: See complete item details
- **✏️ Edit**: Modify item information (coming soon)
- **🗑️ Delete**: Remove item from inventory (with confirmation)

## Supplier Management

### Supported Suppliers
- **Temu** - Orange badge
- **Transpharm** - Blue badge  
- **Medis** - Green badge
- **Other** - Gray badge

### Alternative Names
Use alternative names to track the same product across different suppliers with different listing names.

## Export Functions

### Export for SimpleBlu
1. Go to **Reports** tab
2. Click **"Export for SimplyBlu"**
3. Excel file automatically downloads with proper format for SimpleBlu bulk import

### Full Inventory Export
1. Click **"Export Full Inventory"**
2. Generates comprehensive Excel file with multiple sheets:
   - **Summary**: Overall statistics
   - **Inventory**: Complete item listing
   - **Low Stock**: Items needing attention
   - **Suppliers**: Supplier analysis

## Data Management

### Data Storage
- All data stored locally in your browser's IndexedDB
- No data sent to external servers
- Data persists between browser sessions
- Private and secure

### Backup Recommendations
- Regularly export full inventory as backup
- Save export files to cloud storage or external drives
- Consider multiple backup locations for important data

## Tips for Effective Use

### Organization
- Use consistent naming conventions
- Keep SKUs updated for better tracking
- Add images to quickly identify products
- Use categories to group similar items

### Stock Management
- Set meaningful initial quantities
- Monitor low stock alerts on dashboard
- Update quantities as you receive new stock
- Use alternative names for products with multiple listings

### Supplier Tracking
- Assign primary supplier to each item
- Track seller information for better sourcing
- Use listing names to match supplier catalogs
- Note alternative names for cross-reference

## Troubleshooting

### Common Issues
- **Data not saving**: Check if JavaScript is enabled
- **Images not displaying**: Ensure image files are under 5MB
- **Export not working**: Try using a different browser
- **Performance slow**: Clear browser cache and restart

### Browser Requirements
- Modern browser with IndexedDB support
- JavaScript enabled
- Local storage available
- File API support for images

### Getting Help
- Check browser console (F12) for error messages
- Try refreshing the page
- Clear browser cache if experiencing issues
- Use different browser if problems persist

## Future Features (Coming Soon)

### Phase 2 - Invoice Processing
- Upload supplier invoices
- Automatic item recognition
- Stock level updates from invoices
- Purchase tracking

### Phase 3 - Cloud Integration
- Online database synchronization
- Multi-device access
- Enhanced backup capabilities
- Team collaboration features

---

**FeetOnFocus** - Making inventory management simple and efficient for podiatry practices.