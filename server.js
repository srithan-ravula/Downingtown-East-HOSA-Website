@@ -1,4 +1,5 @@                                                                                                         
 const { Pool } = require('pg');                                                                                        
         user_id INTEGER REFERENCES users(id),                                                                          
         event_id INTEGER REFERENCES events(id),                                                                        
         data JSONB,                                                                                                    
         status VARCHAR(50) DEFAULT 'pending',                                                                          
+        type VARCHAR(50) DEFAULT 'signups',                                                                            
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP                                                                 
       )                                                                                                                
     `);                                                                                                                
                                                                                                                        
     // Create faqs table                                                                                               
     await client.query(`                                                                                               
         id SERIAL PRIMARY KEY,                                                                                         
     next();                                                                                                            
   });                                                                                                                  
 };                                                                                                                     
                                                                                                                        
+// Role-based authorization middleware                                                                                 
+const authorizeRoles = (...allowedRoles) => {                                                                          
+  return (req, res, next) => {                                                                                         
+    if (!req.user || !allowedRoles.includes(req.user.role)) {                                                          
+      return res.status(403).json({ success: false, message: 'Access denied' });                                       
+    }                                                                                                                  
+    next();                                                                                                            
+  };                                                                                                                   
+};                                                                                                                     
+                                                                                                                       
 // POST /api/auth/register - Register new user with bcrypt hashing                                                     
 app.post('/api/auth/register', async (req, res) => {                                                                   
   try {                                                                                                                
     const { email, password, name } = req.body;                                                                        
                                                                                                                        
     if (!email || !password) {                                                                                         
       return res.status(400).json({ success: false, message: 'Email and password required' });                         
     }                                                                                                                  
                                                                                                                        
-    // Check if user exists                                                                                            
     const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);                            
     if (existingUser.rows.length > 0) {                                                                                
       return res.status(400).json({ success: false, message: 'User already exists' });                                 
     }                                                                                                                  
                                                                                                                        
-    // Hash password                                                                                                   
     const password_hash = await bcrypt.hash(password, 10);                                                             
-                                                                                                                       
-    // Determine role dynamically                                                                                      
     const role = await determineUserRole(email);                                                                       
                                                                                                                        
-    // Insert user                                                                                                     
     const result = await pool.query(                                                                                   
       'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',  
       [email, name || email, password_hash, role]                                                                      
     );                                                                                                                 
                                                                                                                        
     const user = result.rows[0];                                                                                       
     const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                           
                                                                                                                        
-    res.json({                                                                                                         
-      success: true,                                                                                                   
-      token,                                                                                                           
-      email: user.email,                                                                                               
-      name: user.name,                                                                                                 
-      role: user.role                                                                                                  
-    });                                                                                                                
+    res.json({ success: true, token, email: user.email, name: user.name, role: user.role });                           
   } catch (error) {                                                                                                    
     console.error('Registration error:', error);                                                                       
     res.status(500).json({ success: false, message: 'Server error' });                                                 
   }                                                                                                                    
 });                                                                                                                    
@@ -253,5 +253,6 @@                                                                                                     
 // POST /api/auth/login/local - Standard email/password login                                                          
     if (!valid) {                                                                                                      
       return res.status(401).json({ success: false, message: 'Invalid credentials' });                                 
     }                                                                                                                  
                                                                                                                        
-    // Dynamically evaluate role                                                                                       
     const role = await determineUserRole(email);                                                                       
     const name = await getUserName(email);                                                                             
                                                                                                                        
     const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET);                                      
     res.json({ success: true, token, email: user.email, name, role });                                                 
@@ -277,5 +276,6 @@                                                                                                     
     res.status(500).json({ success: false, message: 'Server error' });                                                 
       );                                                                                                               
       user = newUser;                                                                                                  
     } else {                                                                                                           
       user = user.rows[0];                                                                                             
-      // Update role dynamically if needed                                                                             
       const role = await determineUserRole(email);                                                                     
       if (user.role !== role) {                                                                                        
         await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, user.id]);                                 
         user.role = role;                                                                                              
       }                                                                                                                
     }                                                                                                                  
     const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);                           
 app.post('/api/auth/login/apple', async (req, res) => {                                                                
   try {                                                                                                                
     const { identityToken, email } = req.body;                                                                         
                                                                                                                        
-    // Apple JS API verification would go here                                                                         
-    // For now, validate the email is provided                                                                         
     if (!email) {                                                                                                      
       return res.status(400).json({ success: false, message: 'Email required for Apple auth' });                       
     }                                                                                                                  
                                                                                                                        
-    // In production, verify the Apple identity token here                                                             
-    // For now, proceed with email-based logic                                                                         
     let user = await pool.query('SELECT * FROM users WHERE apple_id = $1 OR email = $2', [identityToken, email]);      
                                                                                                                        
     if (user.rows.length === 0) {                                                                                      
       const hash = await bcrypt.hash('apple_oauth', 10);                                                               
       const role = await determineUserRole(email);                                                                     
@@ -342,5 +336,6 @@                                                                                                     
         'INSERT INTO users (email, password_hash, apple_id, role) VALUES ($1, $2, $3, $4) RETURNING *',                
     res.status(500).json({ success: false, message: 'Apple auth failed' });                                            
   }                                                                                                                    
 });                                                                                                                    
                                                                                                                        
-// Get events                                                                                                          
-app.get('/api/events', async (req, res) => {                                                                           
-  try {                                                                                                                
-    const result = await pool.query('SELECT * FROM events');                                                           
-    res.json(result.rows);                                                                                             
-  } catch (error) {                                                                                                    
-    res.status(500).json({ error: 'Database error' });                                                                 
-  }                                                                                                                    
-});                                                                                                                    
-                                                                                                                       
-// Add event                                                                                                           
-app.post('/api/events', authenticateToken, async (req, res) => {                                                       
-  try {                                                                                                                
-    const { name, category, team_size } = req.body;                                                                    
-    const result = await pool.query(                                                                                   
-      'INSERT INTO events (name, category, team_size) VALUES ($1, $2, $3) RETURNING *',                                
-      [name, category, team_size || 1]                                                                                 
-    );                                                                                                                 
-    res.json({ success: true, event: result.rows[0] });                                                                
-  } catch (error) {                                                                                                    
-    res.status(500).json({ error: 'Database error' });                                                                 
-  }                                                                                                                    
-});                                                                                                                    
-                                                                                                                       
-// Submit signup                                                                                                       
-app.post('/api/signups', async (req, res) => {                                                                         
-  try {                                                                                                                
+// Officer portal quick auth (checks if email belongs to officer/advisor/dev)                                          
+app.post('/api/auth', async (req, res) => {                                                                            
+  try {                                                                                                                
+    const { email } = req.body;                                                                                        
+    if (!email) {                                                                                                      
+      return res.status(400).json({ success: false, message: 'Email required' });                                      
+    }                                                                                                                  
+                                                                                                                       
+    const role = await determineUserRole(email);                                                                       
+    if (role === 'student') {                                                                                          
+      return res.status(403).json({ success: false, message: 'Access denied. Officer email required.' });              
+    }                                                                                                                  
+                                                                                                                       
+    const name = await getUserName(email);                                                                             
+                                                                                                                       
+    const role = await determineUserRole(email);                                                                       
+    if (role === 'student') {                                                                                          
+      return res.status(403).json({ success: false, message: 'Access denied. Officer email required.' });              
+    }                                                                                                                  
+                                                                                                                       
+    const name = await getUserName(email);                                                                             
+    const token = jwt.sign({ id: null, email, role, name }, JWT_SECRET);                                               
+    if (!email) {                                                                                                      
+      return res.status(400).json({ success: false, message: 'Email required' });                                      
+    }                                                                                                                  
+                                                                                                                       
+    const role = await determineUserRole(email);                                                                       
+    if (role === 'student') {                                                                                          
+      return res.status(403).json({ success: false, message: 'Access denied. Officer email required.' });              
+    }                                                                                                                  
+                                                                                                                       
+    const name = await getUserName(email);                                                                             
+    const token = jwt.sign({ id: null, email, role, name }, JWT_SECRET);                                               
+                                                                                                                       
+    res.json({ success: true, token, email, name, role });                                                             
+  } catch (error) {                                                                                                    
-app.post('/api/signups', async (req, res) => {                                                                         
-  try {                                                                                                                
-    const { name, grade, event, date } = req.body;                                                                     
+// PUT /api/events/:id - Update event (secured)                                                                        
+app.put('/api/events/:id', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {       
+  try {                                                                                                                
+    const { name, category, team_size } = req.body;                                                                    
     const result = await pool.query(                                                                                   
-      'INSERT INTO submissions (user_id, event_id, data) VALUES ($1, $2, $3) RETURNING *',                             
-      [null, null, { name, grade, event, date }]                                                                       
+      'UPDATE events SET name = $1, category = $2, team_size = $3 WHERE id = $4 RETURNING *',                          
+      [name, category, team_size || 1, req.params.id]                                                                  
     );                                                                                                                 
-    res.json({ success: true });                                                                                       
-  } catch (error) {                                                                                                    
+    if (result.rows.length === 0) {                                                                                    
+    }                                                                                                                  
+    res.json({ success: true, event: result.rows[0] });                                                                
   } catch (error) {                                                                                                    
     res.status(500).json({ error: 'Database error' });                                                                 
   }                                                                                                                    
 });                                                                                                                    
                                                                                                                        
+// DELETE /api/events/:id - Delete event (secured)                                                                     
+app.delete('/api/events/:id', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {    
+  try {                                                                                                                
+    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [req.params.id]);                  
+    if (result.rows.length === 0) {                                                                                    
+      return res.status(404).json({ error: 'Event not found' });                                                       
-});                                                                                                                    
+// DELETE /api/events/:id - Delete event (secured)                                                                     
+app.delete('/api/events/:id', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {    
+  try {                                                                                                                
+    const result = await pool.query('DELETE FROM events WHERE id = $1 RETURNING *', [req.params.id]);                  
+    if (result.rows.length === 0) {                                                                                    
+      return res.status(404).json({ error: 'Event not found' });                                                       
+    }                                                                                                                  
+    res.json({ success: true, message: 'Event deleted' });                                                             
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// GET /api/users - Get all users (secured for officers/advisors/devs)                                                 
+app.get('/api/users', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {            
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// GET /api/users - Get all users (secured for officers/advisors/devs)                                                 
+app.get('/api/users', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {            
+  try {                                                                                                                
+    const result = await pool.query('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC');   
+    res.json(result.rows);                                                                                             
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
 });                                                                                                                    
                                                                                                                        
-// Start Server                                                                                                        
-const PORT = process.env.PORT || 3000;                                                                                 
-initDB().then(() => {                                                                                                  
-  app.listen(PORT, () => {                                                                                             
-    console.log(`Server running on http://localhost:${PORT}`);                                                         
-  });                                                                                                                  
-});                                                                                                                    
+// POST /api/presubmissions - Presubmission                                                                            
+app.post('/api/presubmissions', async (req, res) => {                                                                  
+  try {                                                                                                                
+    const { name, grade, event, date } = req.body;                                                                     
+    await pool.query(                                                                                                  
+      'INSERT INTO submissions (data, type) VALUES ($1, $2)',                                                          
+      [{ name, grade, event, date }, 'presubmissions']                                                                 
+    );                                                                                                                 
+    res.json({ success: true });                                                                                       
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// POST /api/runoffs - Runoff                                                                                          
+app.post('/api/runoffs', async (req, res) => {                                                                         
+  try {                                                                                                                
+    const { name, grade, event, date } = req.body;                                                                     
+    await pool.query(                                                                                                  
+      'INSERT INTO submissions (data, type) VALUES ($1, $2)',                                                          
+      [{ name, grade, event, date }, 'runoffs']                                                                        
+    );                                                                                                                 
+    res.json({ success: true });                                                                                       
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// GET /api/submissions/tracker - Track all submissions                                                                
+app.get('/api/submissions/tracker', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) =>
{                                                                                                                       
+  try {                                                                                                                
+    const result = await pool.query(`                                                                                  
+      SELECT s.id, s.type, s.status, s.created_at,                                                                     
+             s.data->>'name' as name,                                                                                  
+             s.data->>'grade' as grade,                                                                                
+             s.data->>'event' as event,                                                                                
+             s.data->>'date' as date                                                                                   
+      FROM submissions s                                                                                               
+      ORDER BY s.created_at DESC                                                                                       
+    `);                                                                                                                
+    res.json(result.rows);                                                                                             
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// PUT /api/submissions/:id/status - Update submission status (secured)                                                
+app.put('/api/submissions/:id/status', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res)
+    if (result.rows.length === 0) {                                                                                    
-});                                                                                                                    
-                                                                                                                       
-// Start Server                                                                                                        
-const PORT = process.env.PORT || 3000;                                                                                 
-initDB().then(() => {                                                                                                  
-  app.listen(PORT, () => {                                                                                             
-    console.log(`Server running on http://localhost:${PORT}`);                                                         
-  });                                                                                                                  
-});                                                                                                                    
+      'UPDATE submissions SET status = $1 WHERE id = $2 RETURNING *',                                                  
+      [status, req.params.id]                                                                                          
+    );                                                                                                                 
+    if (result.rows.length === 0) {                                                                                    
+      return res.status(404).json({ error: 'Submission not found' });                                                  
+    }                                                                                                                  
+    res.json({ success: true, submission: result.rows[0] });                                                           
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// GET /api/faqs - Get all FAQs                                                                                        
+app.get('/api/faqs', async (req, res) => {                                                                             
+  try {                                                                                                                
+    const result = await pool.query('SELECT * FROM faqs ORDER BY created_at DESC');                                    
+    res.json(result.rows);                                                                                             
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// POST /api/faqs - Create FAQ (secured)                                                                               
+app.post('/api/faqs', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {            
+  try {                                                                                                                
+    const { question, answer } = req.body;                                                                             
+    if (!question || !answer) {                                                                                        
+      return res.status(400).json({ success: false, message: 'Question and answer required' });                        
+    }                                                                                                                  
+    const result = await pool.query(                                                                                   
+      'INSERT INTO faqs (question, answer) VALUES ($1, $2) RETURNING *',                                               
+      [question, answer]                                                                                               
+    );                                                                                                                 
+    res.json({ success: true, faq: result.rows[0] });                                                                  
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// DELETE /api/faqs/:id - Delete FAQ (secured)                                                                         
+app.delete('/api/faqs/:id', authenticateToken, authorizeRoles('dev', 'officer', 'advisor'), async (req, res) => {      
+  try {                                                                                                                
+    const result = await pool.query('DELETE FROM faqs WHERE id = $1 RETURNING *', [req.params.id]);                    
+    if (result.rows.length === 0) {                                                                                    
+      return res.status(404).json({ error: 'FAQ not found' });                                                         
+    }                                                                                                                  
+    res.json({ success: true, message: 'FAQ deleted' });                                                               
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// Dev Portal Management Routes (strictly dev-only)                                                                    
+                                                                                                                       
+// GET /api/dev/roles - Get all dev roles                                                                              
+app.get('/api/dev/roles', authenticateToken, authorizeRoles('dev'), async (req, res) => {                              
+  try {                                                                                                                
+    const result = await pool.query('SELECT id, name, email, role, created_at FROM devs ORDER BY created_at DESC');    
+    res.json(result.rows);                                                                                             
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// POST /api/dev/officers - Add officer (dev-only)                                                                     
+app.post('/api/dev/officers', authenticateToken, authorizeRoles('dev'), async (req, res) => {                          
+  try {                                                                                                                
+    const { name, email } = req.body;                                                                                  
+    if (!name || !email) {                                                                                             
+      return res.status(400).json({ success: false, message: 'Name and email required' });                             
+    }                                                                                                                  
+    const result = await pool.query(                                                                                   
+      'INSERT INTO officers (name, email) VALUES ($1, $2) RETURNING *',                                                
+      [name, email]                                                                                                    
+    );                                                                                                                 
+    res.json({ success: true, officer: result.rows[0] });                                                              
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// DELETE /api/dev/officers/:email - Remove officer (dev-only)                                                         
+app.delete('/api/dev/officers/:email', authenticateToken, authorizeRoles('dev'), async (req, res) => {                 
+  try {                                                                                                                
+    const result = await pool.query('DELETE FROM officers WHERE email = $1 RETURNING *', [req.params.email]);          
+    if (result.rows.length === 0) {                                                                                    
+      return res.status(404).json({ error: 'Officer not found' });                                                     
+    }                                                                                                                  
+    res.json({ success: true, message: 'Officer removed' });                                                           
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// POST /api/dev/advisors - Add advisor (dev-only)                                                                     
+app.post('/api/dev/advisors', authenticateToken, authorizeRoles('dev'), async (req, res) => {                          
+  try {                                                                                                                
+    const { name, email } = req.body;                                                                                  
+    if (!name || !email) {                                                                                             
+      return res.status(400).json({ success: false, message: 'Name and email required' });                             
+    }                                                                                                                  
+    const result = await pool.query(                                                                                   
+      'INSERT INTO advisors (name, email) VALUES ($1, $2) RETURNING *',                                                
+      [name, email]                                                                                                    
+    );                                                                                                                 
+    res.json({ success: true, advisor: result.rows[0] });                                                              
+  } catch (error) {                                                                                                    
+    res.status(500).json({ error: 'Database error' });                                                                 
+  }                                                                                                                    
+});                                                                                                                    
+                                                                                                                       
+// DELETE /api/dev/advisors/:email - Remove advisor (dev-only)                                                         
@@ -403,5 +647,6 @@                                                                                                     
 const PORT = process.env.PORT || 3000;                                                                                 
 initDB().then(() => {                                                                                                  
   app.listen(PORT, () => {                                                                                             
     console.log(`Server running on http://localhost:${PORT}`);                                                         
   });  
