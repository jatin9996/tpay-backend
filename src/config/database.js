import { Sequelize } from 'sequelize';
import config from './env.js';

/**
 * PostgreSQL Connection Configuration
 * Handles connection to PostgreSQL with proper error handling and reconnection logic
 */

// Initialize sequelize instance immediately
let sequelize;

// Initialize sequelize instance based on config
if (config.POSTGRES_URI) {
    sequelize = new Sequelize(config.POSTGRES_URI, {
        dialect: 'postgres',
        logging: false, // Set to console.log for debugging
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        retry: {
            max: 3
        }
    });
} else {
    sequelize = new Sequelize(
        config.POSTGRES_DB,
        config.POSTGRES_USER,
        config.POSTGRES_PASSWORD,
        {
            host: config.POSTGRES_HOST,
            port: config.POSTGRES_PORT,
            dialect: 'postgres',
            logging: false, // Set to console.log for debugging
            pool: {
                max: 5,
                min: 0,
                acquire: 30000,
                idle: 10000
            },
            retry: {
                max: 3
            }
        }
    );
}

const connectDB = async () => {
    try {
        // Test the connection
        await sequelize.authenticate();
        console.log('PostgreSQL connected successfully');
        
        // Note: Removed automatic sync with alter: true to prevent column type casting issues
        // Database initialization should be handled explicitly through scripts
        console.log('Database connection established (no automatic schema changes)');
        
        // Handle connection events
        sequelize.addHook('afterConnect', (connection) => {
            console.log('New PostgreSQL connection established');
        });
        
        // Graceful shutdown
        process.on('SIGINT', async () => {
            await sequelize.close();
            console.log('PostgreSQL connection closed through app termination');
            process.exit(0);
        });
        
    } catch (error) {
        console.error('PostgreSQL connection failed:', error.message);
        process.exit(1);
    }
};

export { sequelize, connectDB };
export default connectDB;
