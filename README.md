
## 🚀 Quick Start

### Prerequisites

1. **PostgreSQL** installed and running
2. **Node.js** (v16 or higher)
3. **npm** or **yarn**

### 1. Install Dependencies

```bash
npm install
```


#### Option B: Using Connection String

```bash
POSTGRES_URI=postgresql://username:password@localhost:5432/tpay
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE tpay;

# Exit
\q
```

### 4. Initialize Database

```bash
# Initialize database tables and indexes
npm run db:init

# Seed with initial data
npm run db:seed

# Or do both at once
npm run db:reset
```

### 5. Start the Server

```bash
npm start
```

The server will start on port 3001 (or the port specified in your environment variables).

## 🏗️ Database Schema

The application includes the following models:

- **Token** - ERC-20 token information
- **Pool** - Liquidity pool/pair data
- **Swap** - Swap transaction records
- **Quote** - Price quotes with TTL
- **SwapAnalytics** - Aggregated swap analytics
- **TokenStats24h** - 24-hour token statistics

## 📊 Database Operations

All database operations now use **Sequelize ORM** with the following patterns:

### Creating Records
```javascript
// Old MongoDB way
const token = new Token(data);
await token.save();

// New Sequelize way
const token = await Token.create(data);
```

### Finding Records
```javascript
// Old MongoDB way
const tokens = await Token.find({ isActive: true });

// New Sequelize way
const tokens = await Token.findAll({ where: { isActive: true } });
```

### Updating Records
```javascript
// Old MongoDB way
await Token.updateOne({ address }, { $set: data });

// New Sequelize way
await Token.update(data, { where: { address } });
```

### Counting Records
```javascript
// Old MongoDB way
const count = await Token.countDocuments({ isActive: true });

// New Sequelize way
const count = await Token.count({ where: { isActive: true } });
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_DB` | Database name | `tpay` |
| `POSTGRES_USER` | Database user | `postgres` |
| `POSTGRES_PASSWORD` | Database password | (required) |
| `POSTGRES_URI` | Full connection string | (optional) |

### Database Connection

The database connection is configured in `src/config/database.js` with:

- Connection pooling
- Automatic reconnection
- Graceful shutdown handling
- Model synchronization

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:search
npm run test:ethereum
npm run test:chains
npm run test:tokens
npm run test:exact-out
```

## 📁 Project Structure

```
src/
├── config/          # Configuration files
├── models/          # Sequelize models
├── routes/          # API routes
├── services/        # Business logic
├── jobs/            # Background jobs
├── scripts/         # Database scripts
└── utils/           # Utility functions
```

## 🔄 Migration Notes

### What Changed

1. **Database**: MongoDB → PostgreSQL
2. **ORM**: Mongoose → Sequelize
3. **Query Syntax**: Updated to use Sequelize methods
4. **Connection**: PostgreSQL connection with connection pooling
5. **Indexes**: PostgreSQL-specific index optimization

### What Stayed the Same

1. **API Endpoints**: All routes remain unchanged
2. **Business Logic**: Core functionality preserved
3. **Data Models**: Structure maintained, syntax updated
4. **Configuration**: Environment-based configuration preserved

## 🚨 Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure PostgreSQL is running
   - Check host/port configuration
   - Verify firewall settings

2. **Authentication Failed**
   - Check username/password
   - Verify database exists
   - Check user permissions

3. **Table Not Found**
   - Run `npm run db:init` to create tables
   - Check model synchronization

4. **Permission Denied**
   - Ensure database user has proper permissions
   - Check database ownership

### Debug Mode

Enable Sequelize logging by setting in `src/config/database.js`:

```javascript
logging: console.log // Change from false to console.log
```

## 📚 Additional Resources

- [Sequelize Documentation](https://sequelize.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Node.js PostgreSQL](https://node-postgres.com/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License.
