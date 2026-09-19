const express = require('express');                                                                                     
const { Pool } = require('pg');                                                                                         
const bcrypt = require('bcrypt');                                                                                       
const jwt = require('jsonwebtoken');                                                                                    
const { OAuth2Client } = require('google-auth-library');                                                                
const path = require('path');                                                                                           
const app = express();                                                                                                  
                                                                                                                        
app.use(express.json());                                                                                                
app.use(express.static(path.join(__dirname)));                                                                          
                                                                                                                        
// PostgreSQL Connection Pool                                                                                           
const pool = new Pool({                                                                                                 
  connectionString: process.env.DATABASE_URL,                                                                           
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false                                    
});                                                                                                                     
                                                                                                                        
// JWT Secret                                                                                                           
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';                                    
                                                                                                                        
// Google OAuth Client                                                                                                  
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);                                                    
                                                                                                                        
// Initialize Database                                                                                                  
async function initDB() {                                                                                               
  const client = await pool.connect();                                                                                  
  try {                                                                                                                 
    // Create users table                                                                                               
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS users (                                                                                
        id SERIAL PRIMARY KEY,                                                                                          
        email VARCHAR(255) UNIQUE NOT NULL,                                                                             
        password_hash VARCHAR(255),                                                                                     
        role VARCHAR(50) DEFAULT 'student',                                                                             
        google_id VARCHAR(255),                                                                                         
        apple_id VARCHAR(255),                                                                                          
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Create devs table                                                                                                
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS devs (                                                                                 
        id SERIAL PRIMARY KEY,                                                                                          
        name VARCHAR(255) NOT NULL,                                                                                     
        email VARCHAR(255) UNIQUE NOT NULL,                                                                             
        role VARCHAR(50) DEFAULT 'developer',                                                                           
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Create advisors table                                                                                            
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS advisors (                                                                             
        id SERIAL PRIMARY KEY,                                                                                          
        name VARCHAR(255) NOT NULL,                                                                                     
        email VARCHAR(255) UNIQUE NOT NULL,                                                                             
        role VARCHAR(50) DEFAULT 'advisor',                                                                             
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Create officers table                                                                                            
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS officers (                                                                             
        id SERIAL PRIMARY KEY,                                                                                          
        name VARCHAR(255) NOT NULL,                                                                                     
        email VARCHAR(255) UNIQUE NOT NULL,                                                                             
        role VARCHAR(50) DEFAULT 'officer',                                                                             
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Create events table                                                                                              
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS events (                                                                               
        id SERIAL PRIMARY KEY,                                                                                          
        name VARCHAR(255) NOT NULL,                                                                                     
        category VARCHAR(100),                                                                                          
        team_size INTEGER DEFAULT 1,                                                                                    
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Create submissions table                                                                                         
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS submissions (                                                                          
        id SERIAL PRIMARY KEY,                                                                                          
        user_id INTEGER REFERENCES users(id),                                                                           
        event_id INTEGER REFERENCES events(id),                                                                         
        data JSONB,                                                                                                     
        status VARCHAR(50) DEFAULT 'pending',                                                                           
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Create faqs table                                                                                                
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS faqs (                                                                                 
        id SERIAL PRIMARY KEY,                                                                                          
        question TEXT NOT NULL,                                                                                         
        answer TEXT NOT NULL,                                                                                           
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                  
      )                                                                                                                 
    `);                                                                                                                 
                                                                                                                        
    // Auto-seed Devs                                                                                                   
    const devs = [                                                                                                      
      { name: 'Admin User', email: 'admin@hosa.edu' },                                                                  
      { name: 'Dev Lead', email: 'devlead@hosa.edu' }                                                                   
    ];                                                                                                                  
                                                                                                                        
    for (const dev of devs) {                                                                                           
      await client.query(                                                                                               
        `INSERT INTO devs (name, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,                                
        [dev.name, dev.email]                                                                                           
      );                                                                                                                
    }                                                                                                                   
                                                                                                                        
    // Auto-seed Advisors                                                                                               
    const advisors = [                                                                                                  
      { name: 'Mrs. Smith', email: 'asmith@school.edu' },                                                               
      { name: 'Mr. Johnson', email: 'mjohnson@school.edu' }                                                             
    ];                                                                                                                  
                                                                                                                        
    for (const advisor of advisors) {                                                                                   
      await client.query(                                                                                               
        `INSERT INTO advisors (name, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,                            
        [advisor.name, advisor.email]                                                                                   
      );                                                                                                                
    }                                                                                                                   
                                                                                                                        
    // Auto-seed Officers                                                                                               
    const officers = [                                                                                                  
      { name: 'President', email: 'president@hosa.edu' },                                                               
      { name: 'Vice President', email: 'vp@hosa.edu' }                                                                  
    ];                                                                                                                  
                                                                                                                        
    for (const officer of officers) {                                                                                   
      await client.query(                                                                                               
        `INSERT INTO officers (name, email) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,                            
        [officer.name, officer.email]                                                                                   
      );                                                                                                                
    }                                                                                                                   
                                                                                                                        
    console.log('Database initialized and seeded successfully');                                                        
  } catch (err) {                                                                                                       
    console.error('Database initialization error:', err);                                                               
  } finally {                                                                                                           
    client.release();                                                                                                   
  }                                                                                                                     
}                                                                                                                       
                                                                                                                        
// Auth middleware                                                                                                      
const authenticateToken = (req, res, next) => {                                                                         
  const authHeader = req.headers['authorization'];                                                                      
  const token = authHeader && authHeader.split(' ')[1];                                                                 
                                                                                                                        
  if (!token) return res.sendStatus(401);                                                                               
                                                                                                                        
  jwt.verify(token, JWT_SECRET, (err, user) => {                                                                        
    if (err) return res.sendStatus(403);                                                                                
    req.user = user;                                                                                                    
    next();                                                                                                             
  });                                                                                                                   
};                                                                                                                      
                                                                                                                        
// Standard Email/Password Login                                                                                        
app.post('/api/auth/email', async (req, res) => {                                                                       
  try {                                                                                                                 
    const { email, password } = req.body;                                                                               
                                                                                                                        
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);                                   
    const user = result.rows[0];                                                                                        
                                                                                                                        
    if (!user || !user.password_hash) {                                                                                 
      return res.status(401).json({ success: false, message: 'Invalid credentials' });                                  
    }                                                                                                                   
                                                                                                                        
    const valid = await bcrypt.compare(password, user.password_hash);                                                   
    if (!valid) {                                                                                                       
      return res.status(401).json({ success: false, message: 'Invalid credentials' });                                  
    }                                                                                                                   
                                                                                                                        
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                            
    res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role } });                      
  } catch (error) {                                                                                                     
    res.status(500).json({ success: false, message: 'Server error' });                                                  
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// Google Sign-In                                                                                                       
app.post('/api/auth/google', async (req, res) => {                                                                      
  try {                                                                                                                 
    const { credential } = req.body;                                                                                    
    const ticket = await googleClient.verifyIdToken({                                                                   
      idToken: credential,                                                                                              
      audience: process.env.GOOGLE_CLIENT_ID                                                                            
    });                                                                                                                 
    const payload = ticket.getPayload();                                                                                
    const googleId = payload.sub;                                                                                       
    const email = payload.email;                                                                                        
                                                                                                                        
    let user = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);           
                                                                                                                        
    if (user.rows.length === 0) {                                                                                       
      const hash = await bcrypt.hash('google_oauth', 10);                                                               
      const newUser = await pool.query(                                                                                 
        'INSERT INTO users (email, password_hash, google_id, role) VALUES ($1, $2, $3, $4) RETURNING *',                
        [email, hash, googleId, 'student']                                                                              
      );                                                                                                                
      user = newUser;                                                                                                   
    } else {                                                                                                            
      user = user.rows[0];                                                                                              
    }                                                                                                                   
                                                                                                                        
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                            
    res.json({ success: true, token, user: { id: user.id, email: user.email, role: user.role } });                      
  } catch (error) {                                                                                                     
    res.status(500).json({ success: false, message: 'Google auth failed' });                                            
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// Apple Sign-In                                                                                                        
app.post('/api/auth/apple', async (req, res) => {                                                                       
  try {                                                                                                                 
    const { identityToken } = req.body;                                                                                 
    // Apple JS API verification would go here                                                                          
    // For now, return success with placeholder                                                                         
    res.json({ success: true, message: 'Apple auth endpoint ready' });                                                  
  } catch (error) {                                                                                                     
    res.status(500).json({ success: false, message: 'Apple auth failed' });                                             
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// Get events                                                                                                           
app.get('/api/events', async (req, res) => {                                                                            
  try {                                                                                                                 
    const result = await pool.query('SELECT * FROM events');                                                            
    res.json(result.rows);                                                                                              
  } catch (error) {                                                                                                     
    res.status(500).json({ error: 'Database error' });                                                                  
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// Add event                                                                                                            
app.post('/api/events', authenticateToken, async (req, res) => {                                                        
  try {                                                                                                                 
    const { name, category, team_size } = req.body;                                                                     
    const result = await pool.query(                                                                                    
      'INSERT INTO events (name, category, team_size) VALUES ($1, $2, $3) RETURNING *',                                 
      [name, category, team_size || 1]                                                                                  
    );                                                                                                                  
    res.json({ success: true, event: result.rows[0] });                                                                 
  } catch (error) {                                                                                                     
    res.status(500).json({ error: 'Database error' });                                                                  
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// Submit signup                                                                                                        
app.post('/api/signups', async (req, res) => {                                                                          
  try {                                                                                                                 
    const { name, grade, event, date } = req.body;                                                                      
    const result = await pool.query(                                                                                    
      'INSERT INTO submissions (user_id, event_id, data) VALUES ($1, $2, $3) RETURNING *',                              
      [null, null, { name, grade, event, date }]                                                                        
    );                                                                                                                  
    res.json({ success: true });                                                                                        
  } catch (error) {                                                                                                     
    res.status(500).json({ error: 'Database error' });                                                                  
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// Start Server                                                                                                         
const PORT = process.env.PORT || 3000;                                                                                  
initDB().then(() => {                                                                                                   
  app.listen(PORT, () => {                                                                                              
    console.log(`Server running on http://localhost:${PORT}`);                                                          
  });                                                                                                                   
}); 
