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
                                                                                                                        
// Helper function to dynamically determine user role from specialized tables                                           
async function determineUserRole(email) {                                                                               
  try {                                                                                                                 
    const devCheck = await pool.query('SELECT role FROM devs WHERE email = $1', [email]);                               
    if (devCheck.rows.length > 0) return devCheck.rows[0].role || 'dev';                                                
                                                                                                                        
    const advisorCheck = await pool.query('SELECT role FROM advisors WHERE email = $1', [email]);                       
    if (advisorCheck.rows.length > 0) return advisorCheck.rows[0].role || 'advisor';                                    
                                                                                                                        
    const officerCheck = await pool.query('SELECT role FROM officers WHERE email = $1', [email]);                       
    if (officerCheck.rows.length > 0) return officerCheck.rows[0].role || 'officer';                                    
                                                                                                                        
    return 'student';                                                                                                   
  } catch (error) {                                                                                                     
    console.error('Error determining user role:', error);                                                               
    return 'student';                                                                                                   
  }                                                                                                                     
}                                                                                                                       
                                                                                                                        
// Helper function to get user name from specialized tables or users table                                              
async function getUserName(email) {                                                                                     
  try {                                                                                                                 
    const devCheck = await pool.query('SELECT name FROM devs WHERE email = $1', [email]);                               
    if (devCheck.rows.length > 0) return devCheck.rows[0].name;                                                         
                                                                                                                        
    const advisorCheck = await pool.query('SELECT name FROM advisors WHERE email = $1', [email]);                       
    if (advisorCheck.rows.length > 0) return advisorCheck.rows[0].name;                                                 
                                                                                                                        
    const officerCheck = await pool.query('SELECT name FROM officers WHERE email = $1', [email]);                       
    if (officerCheck.rows.length > 0) return officerCheck.rows[0].name;                                                 
                                                                                                                        
    const userCheck = await pool.query('SELECT name FROM users WHERE email = $1', [email]);                             
    if (userCheck.rows.length > 0) return userCheck.rows[0].name;                                                       
                                                                                                                        
    return email;                                                                                                       
  } catch (error) {                                                                                                     
    console.error('Error getting user name:', error);                                                                   
    return email;                                                                                                       
  }                                                                                                                     
}                                                                                                                       
                                                                                                                        
// Initialize Database                                                                                                  
async function initDB() {                                                                                               
  const client = await pool.connect();                                                                                  
  try {                                                                                                                 
    // Create users table with name field                                                                               
    await client.query(`                                                                                                
      CREATE TABLE IF NOT EXISTS users (                                                                                
        id SERIAL PRIMARY KEY,                                                                                          
        email VARCHAR(255) UNIQUE NOT NULL,                                                                             
        name VARCHAR(255),                                                                                              
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
                                                                                                                        
// POST /api/auth/register - Register new user with bcrypt hashing                                                      
app.post('/api/auth/register', async (req, res) => {                                                                    
  try {                                                                                                                 
    const { email, password, name } = req.body;                                                                         
                                                                                                                        
    if (!email || !password) {                                                                                          
      return res.status(400).json({ success: false, message: 'Email and password required' });                          
    }                                                                                                                   
                                                                                                                        
    // Check if user exists                                                                                             
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);                             
    if (existingUser.rows.length > 0) {                                                                                 
      return res.status(400).json({ success: false, message: 'User already exists' });                                  
    }                                                                                                                   
                                                                                                                        
    // Hash password                                                                                                    
    const password_hash = await bcrypt.hash(password, 10);                                                              
                                                                                                                        
    // Determine role dynamically                                                                                       
    const role = await determineUserRole(email);                                                                        
                                                                                                                        
    // Insert user                                                                                                      
    const result = await pool.query(                                                                                    
      'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',   
      [email, name || email, password_hash, role]                                                                       
    );                                                                                                                  
                                                                                                                        
    const user = result.rows[0];                                                                                        
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                            
                                                                                                                        
    res.json({                                                                                                          
      success: true,                                                                                                    
      token,                                                                                                            
      email: user.email,                                                                                                
      name: user.name,                                                                                                  
      role: user.role                                                                                                   
    });                                                                                                                 
  } catch (error) {                                                                                                     
    console.error('Registration error:', error);                                                                        
    res.status(500).json({ success: false, message: 'Server error' });                                                  
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// POST /api/auth/login/local - Standard email/password login                                                           
app.post('/api/auth/login/local', async (req, res) => {                                                                 
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
                                                                                                                        
    // Dynamically evaluate role                                                                                        
    const role = await determineUserRole(email);                                                                        
    const name = await getUserName(email);                                                                              
                                                                                                                        
    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET);                                       
    res.json({ success: true, token, email: user.email, name, role });                                                  
  } catch (error) {                                                                                                     
    res.status(500).json({ success: false, message: 'Server error' });                                                  
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// POST /api/auth/login/google - Google OAuth login                                                                     
app.post('/api/auth/login/google', async (req, res) => {                                                                
  try {                                                                                                                 
    const { credential } = req.body;                                                                                    
    const ticket = await googleClient.verifyIdToken({                                                                   
      idToken: credential,                                                                                              
      audience: process.env.GOOGLE_CLIENT_ID                                                                            
    });                                                                                                                 
    const payload = ticket.getPayload();                                                                                
    const googleId = payload.sub;                                                                                       
    const email = payload.email;                                                                                        
    const name = payload.name;                                                                                          
                                                                                                                        
    let user = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);           
                                                                                                                        
    if (user.rows.length === 0) {                                                                                       
      const hash = await bcrypt.hash('google_oauth', 10);                                                               
      const role = await determineUserRole(email);                                                                      
      const newUser = await pool.query(                                                                                 
        'INSERT INTO users (email, name, password_hash, google_id, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',      
        [email, name, hash, googleId, role]                                                                             
      );                                                                                                                
      user = newUser;                                                                                                   
    } else {                                                                                                            
      user = user.rows[0];                                                                                              
      // Update role dynamically if needed                                                                              
      const role = await determineUserRole(email);                                                                      
      if (user.role !== role) {                                                                                         
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);                                  
        user.role = role;                                                                                               
      }                                                                                                                 
    }                                                                                                                   
                                                                                                                        
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                            
    const userName = await getUserName(email);                                                                          
                                                                                                                        
    res.json({ success: true, token, email: user.email, name: userName, role: user.role });                             
  } catch (error) {                                                                                                     
    res.status(500).json({ success: false, message: 'Google auth failed' });                                            
  }                                                                                                                     
});                                                                                                                     
                                                                                                                        
// POST /api/auth/login/apple - Apple Sign-In                                                                           
app.post('/api/auth/login/apple', async (req, res) => {                                                                 
  try {                                                                                                                 
    const { identityToken, email } = req.body;                                                                          
                                                                                                                        
    // Apple JS API verification would go here                                                                          
    // For now, validate the email is provided                                                                          
    if (!email) {                                                                                                       
      return res.status(400).json({ success: false, message: 'Email required for Apple auth' });                        
    }                                                                                                                   
                                                                                                                        
    // In production, verify the Apple identity token here                                                              
    // For now, proceed with email-based logic                                                                          
    let user = await pool.query('SELECT * FROM users WHERE apple_id = $1 OR email = $2', [identityToken, email]);       
                                                                                                                        
    if (user.rows.length === 0) {                                                                                       
      const hash = await bcrypt.hash('apple_oauth', 10);                                                                
      const role = await determineUserRole(email);                                                                      
      const newUser = await pool.query(                                                                                 
        'INSERT INTO users (email, password_hash, apple_id, role) VALUES ($1, $2, $3, $4) RETURNING *',                 
        [email, hash, identityToken, role]                                                                              
      );                                                                                                                
      user = newUser;                                                                                                   
    } else {                                                                                                            
      user = user.rows[0];                                                                                              
      const role = await determineUserRole(email);                                                                      
      if (user.role !== role) {                                                                                         
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);                                  
        user.role = role;                                                                                               
      }                                                                                                                 
    }                                                                                                                   
                                                                                                                        
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                            
    const userName = await getUserName(email);                                                                          
                                                                                                                        
    res.json({ success: true, token, email: user.email, name: userName, role: user.role });                             
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
