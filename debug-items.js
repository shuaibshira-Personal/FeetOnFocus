// Debug script to examine the database contents
// Run this in the browser console (F12)

async function debugItemsInDatabase() {
    console.log('🔍 === DEBUGGING ITEMS IN DATABASE ===');
    
    try {
        // Get all items from the database
        const items = await inventoryDB.getAllItems();
        console.log(`📊 Total items in database: ${items.length}`);
        
        // Check each item
        items.forEach((item, index) => {
            console.log(`\n--- Item ${index + 1} ---`);
            console.log('ID:', item.id);
            console.log('Name:', item.name, typeof item.name);
            console.log('Type:', item.itemType);
            console.log('SKU:', item.sku);
            console.log('Category:', item.category);
            console.log('Supplier:', item.supplier);
            console.log('Created:', item.createdAt);
            console.log('Raw object:', item);
            
            // Check for null/undefined values
            if (item.name === null) {
                console.log('❌ NAME IS NULL!');
            }
            if (item.name === undefined) {
                console.log('❌ NAME IS UNDEFINED!');
            }
            if (item.name === 'null') {
                console.log('❌ NAME IS STRING "null"!');
            }
            if (!item.name || item.name === '') {
                console.log('❌ NAME IS EMPTY OR FALSY!');
            }
        });
        
        // Check for items without names
        const itemsWithoutNames = items.filter(item => !item.name || item.name === null || item.name === 'null');
        if (itemsWithoutNames.length > 0) {
            console.log(`\n⚠️ Found ${itemsWithoutNames.length} items without proper names:`);
            itemsWithoutNames.forEach(item => {
                console.log('Bad item:', item);
            });
        }
        
        // Check the filtered items that would be displayed
        console.log('\n🔍 === CHECKING FILTERED ITEMS FOR CONSUMABLES ===');
        const consumables = items.filter(item => {
            const type = item.itemType || 'reselling';
            return type === 'consumable';
        });
        console.log(`📊 Consumables found: ${consumables.length}`);
        consumables.forEach((item, index) => {
            console.log(`Consumable ${index + 1}:`, item.name, '(ID:', item.id, ')');
        });
        
    } catch (error) {
        console.error('❌ Error debugging items:', error);
    }
    
    console.log('🔍 === DEBUG COMPLETE ===');
}

// Also add a function to clean up bad items
async function cleanupBadItems() {
    console.log('🧹 === CLEANING UP BAD ITEMS ===');
    
    try {
        const items = await inventoryDB.getAllItems();
        const badItems = items.filter(item => !item.name || item.name === null || item.name === 'null' || item.name === '');
        
        console.log(`Found ${badItems.length} bad items to clean up`);
        
        for (const badItem of badItems) {
            console.log('Deleting bad item:', badItem);
            await inventoryDB.deleteItem(badItem.id);
        }
        
        console.log('✅ Cleanup complete');
        
        // Reload the items view
        if (itemsManager) {
            await itemsManager.loadItems();
        }
        
    } catch (error) {
        console.error('❌ Error cleaning up items:', error);
    }
}

// Make functions available globally
window.debugItemsInDatabase = debugItemsInDatabase;
window.cleanupBadItems = cleanupBadItems;

console.log('Debug functions loaded. Run debugItemsInDatabase() or cleanupBadItems() in console.');