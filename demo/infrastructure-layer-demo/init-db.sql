-- rawsql-ts Infrastructure Layer Demo Database Schema
-- This script initializes the database with sample data for testing DTO patterns

-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for testing different search scenarios
INSERT INTO todos (title, description, status, priority, created_at) VALUES
    ('Complete project documentation', 'Write comprehensive docs for the new feature', 'pending', 'high', CURRENT_TIMESTAMP - INTERVAL '1 day'),
    ('Fix authentication bug', 'Resolve login issues reported by users', 'in_progress', 'high', CURRENT_TIMESTAMP - INTERVAL '2 days'),
    ('Update dependency versions', 'Upgrade all packages to latest stable versions', 'pending', 'medium', CURRENT_TIMESTAMP - INTERVAL '3 days'),
    ('Design new user interface', 'Create mockups for the dashboard redesign', 'completed', 'medium', CURRENT_TIMESTAMP - INTERVAL '5 days'),
    ('Implement search feature', 'Add full-text search functionality', 'pending', 'high', CURRENT_TIMESTAMP - INTERVAL '1 hour'),
    ('Refactor database queries', 'Optimize slow-running SQL queries', 'in_progress', 'medium', CURRENT_TIMESTAMP - INTERVAL '6 hours'),
    ('Write unit tests', 'Increase test coverage to 90%+', 'pending', 'low', CURRENT_TIMESTAMP - INTERVAL '2 weeks'),
    ('Deploy to staging', 'Push latest changes to staging environment', 'completed', 'high', CURRENT_TIMESTAMP - INTERVAL '1 week'),
    ('Review code changes', 'Conduct thorough code review for PR #123', 'pending', 'medium', CURRENT_TIMESTAMP - INTERVAL '4 hours'),
    ('Setup CI/CD pipeline', 'Configure automated deployment workflow', 'cancelled', 'low', CURRENT_TIMESTAMP - INTERVAL '1 month'),
    ('Security audit', 'Perform comprehensive security assessment', 'pending', 'high', CURRENT_TIMESTAMP - INTERVAL '30 minutes'),
    ('Performance optimization', 'Improve application response times', 'in_progress', 'medium', CURRENT_TIMESTAMP - INTERVAL '3 hours');

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_title ON todos USING gin(to_tsvector('english', title));

-- Display sample data count
SELECT 
    status,
    priority,
    COUNT(*) as count
FROM todos 
GROUP BY status, priority
ORDER BY status, priority;
