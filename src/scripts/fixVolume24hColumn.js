import { connectDB, sequelize } from '../config/database.js';

/**
 * Script to fix the volume24h column type issue in the tokens table
 * This handles the case where the existing column type cannot be automatically cast to DECIMAL(30,2)
 */

const fixVolume24hColumn = async () => {
    try {
        console.log('Starting volume24h column fix...');
        
        // Connect to database
        await connectDB();
        
        // Check if tokens table exists
        const [tableExists] = await sequelize.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'tokens'
            );
        `);
        
        if (!tableExists[0].exists) {
            console.log('Tokens table does not exist. No fix needed.');
            return;
        }
        
        // Check the current column type
        const [columnInfo] = await sequelize.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'tokens' 
            AND column_name = 'volume24h'
        `);
        
        if (columnInfo.length === 0) {
            console.log('volume24h column does not exist. No fix needed.');
            return;
        }
        
        const currentType = columnInfo[0].data_type;
        console.log(`Current volume24h column type: ${currentType}`);
        
        // If the column is already the correct type, no fix needed
        if (['numeric', 'decimal'].includes(currentType)) {
            console.log('volume24h column is already the correct type. No fix needed.');
            return;
        }
        
        console.log('Column type mismatch detected. Attempting to fix...');
        
        // Try to safely alter the column type
        try {
            // First, create a backup of the table data
            console.log('Creating backup of tokens table...');
            await sequelize.query(`
                CREATE TABLE tokens_backup AS 
                SELECT * FROM tokens
            `);
            console.log('Backup table created successfully');
            
            // Try to alter the column type
            console.log('Attempting to alter column type...');
            await sequelize.query(`
                ALTER TABLE tokens 
                ALTER COLUMN volume24h TYPE DECIMAL(30,2) 
                USING volume24h::DECIMAL(30,2)
            `);
            console.log('Column type altered successfully!');
            
            // Drop the backup table
            await sequelize.query('DROP TABLE tokens_backup');
            console.log('Backup table dropped');
            
        } catch (alterError) {
            console.log('Column alteration failed:', alterError.message);
            console.log('Attempting to recreate the table...');
            
            // If alteration fails, recreate the table
            try {
                // Drop the current table
                await sequelize.query('DROP TABLE tokens CASCADE');
                console.log('Tokens table dropped');
                
                // Recreate the table using Sequelize sync
                const Token = (await import('../models/Token.js')).default;
                await Token.sync({ force: true });
                console.log('Tokens table recreated successfully');
                
            } catch (recreateError) {
                console.error('Table recreation failed:', recreateError.message);
                throw recreateError;
            }
        }
        
        console.log('volume24h column fix completed successfully!');
        
    } catch (error) {
        console.error('Failed to fix volume24h column:', error);
        throw error;
    }
};

// Run the fix
if (import.meta.url === `file://${process.argv[1]}`) {
    fixVolume24hColumn()
        .then(() => {
            console.log('Column fix completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Column fix failed:', error);
            process.exit(1);
        });
}

export default fixVolume24hColumn;
