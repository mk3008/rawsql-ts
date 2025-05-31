-- rawsql-ts Infrastructure Layer Demo Database Schema
-- This script demonstrates 1:N relationships with realistic Todo application tables

-- Create category table (1:N with todo)
CREATE TABLE IF NOT EXISTS category (
    category_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7), -- Hex color code like #FF5733
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create todo table with category foreign key
CREATE TABLE IF NOT EXISTS todo (
    todo_id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    category_id INTEGER REFERENCES category(category_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create todo_comment table (1:N with todo)
CREATE TABLE IF NOT EXISTS todo_comment (
    todo_comment_id SERIAL PRIMARY KEY,
    todo_id INTEGER NOT NULL REFERENCES todo(todo_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample categories
INSERT INTO category (name, description, color) VALUES
    ('Work', 'Work-related tasks and projects', '#3498db'),
    ('Personal', 'Personal tasks and activities', '#e74c3c'),
    ('Learning', 'Study and skill development', '#f39c12'),
    ('Health', 'Health and fitness related', '#2ecc71'),
    ('Finance', 'Financial planning and budgeting', '#9b59b6');

-- Insert sample todos with category relationships
INSERT INTO todo (title, description, status, priority, category_id, created_at) VALUES
    ('Complete project documentation', 'Write comprehensive docs for the new feature', 'pending', 'high', 1, CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('Fix authentication bug', 'Resolve login issues reported by users', 'in_progress', 'high', 1, CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('Update dependency versions', 'Upgrade all packages to latest stable versions', 'pending', 'medium', 1, CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('Morning workout routine', 'Complete 30-minute cardio session', 'completed', 'medium', 4, CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('Implement search feature', 'Add full-text search functionality', 'pending', 'high', 1, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    ('Read TypeScript handbook', 'Study advanced TypeScript patterns', 'in_progress', 'medium', 3, CURRENT_TIMESTAMP - INTERVAL '6 hours'),
    ('Plan vacation budget', 'Calculate expenses for summer trip', 'pending', 'low', 5, CURRENT_TIMESTAMP - INTERVAL '2 weeks'),
    ('Deploy to staging', 'Push latest changes to staging environment', 'completed', 'high', 1, CURRENT_TIMESTAMP - INTERVAL '1 week'),
    ('Grocery shopping', 'Buy ingredients for weekly meal prep', 'pending', 'medium', 2, CURRENT_TIMESTAMP - INTERVAL '4 hours'),
    ('Learn PostgreSQL JSON queries', 'Practice JSON operations and indexing', 'cancelled', 'low', 3, CURRENT_TIMESTAMP - INTERVAL '1 month'),
    ('Security audit', 'Perform comprehensive security assessment', 'pending', 'high', 1, CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
    ('Annual health checkup', 'Schedule and attend medical examination', 'in_progress', 'medium', 4, CURRENT_TIMESTAMP - INTERVAL '3 hours');

-- Insert sample comments for todos (demonstrating 1:N relationship)
INSERT INTO todo_comment (todo_id, content, author_name, created_at) VALUES
    (1, 'Started working on the API documentation section', 'Alice Johnson', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    (1, 'Need to add more code examples', 'Bob Smith', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    (1, 'Should we include deployment instructions?', 'Charlie Brown', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
    (2, 'Identified the root cause - session timeout issue', 'Alice Johnson', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (2, 'Fixed the timeout, now testing edge cases', 'Alice Johnson', CURRENT_TIMESTAMP - INTERVAL '4 hours'),
    (5, 'Elasticsearch integration looks promising', 'Dave Wilson', CURRENT_TIMESTAMP - INTERVAL '2 hours'),
    (5, 'Performance benchmarks look good so far', 'Eve Davis', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    (6, 'Chapter 3 on generics was really helpful', 'Bob Smith', CURRENT_TIMESTAMP - INTERVAL '3 hours'),
    (9, 'Added organic vegetables to the list', 'Charlie Brown', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    (11, 'Found several potential vulnerabilities', 'Frank Miller', CURRENT_TIMESTAMP - INTERVAL '45 minutes'),
    (11, 'Updated dependency versions to patch security issues', 'Frank Miller', CURRENT_TIMESTAMP - INTERVAL '15 minutes');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_todo_status ON todo(status);
CREATE INDEX IF NOT EXISTS idx_todo_priority ON todo(priority);
CREATE INDEX IF NOT EXISTS idx_todo_category_id ON todo(category_id);
CREATE INDEX IF NOT EXISTS idx_todo_created_at ON todo(created_at);
CREATE INDEX IF NOT EXISTS idx_todo_title ON todo USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_todo_comment_todo_id ON todo_comment(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_comment_created_at ON todo_comment(created_at);

-- Display sample data with relationships
SELECT 
    'Categories' as table_name,
    COUNT(*) as count
FROM category
UNION ALL
SELECT 
    'Todos' as table_name,
    COUNT(*) as count
FROM todo
UNION ALL
SELECT 
    'Comments' as table_name,
    COUNT(*) as count
FROM todo_comment;

-- Display todos with category information
SELECT 
    c.name as category,
    t.status,
    COUNT(*) as todo_count
FROM todo t
LEFT JOIN category c ON t.category_id = c.category_id
GROUP BY c.name, t.status
ORDER BY c.name, t.status;
