-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO todos (title, description, status, priority, created_at) VALUES
    ('完成プレゼンテーション', 'Q4プレゼンテーションを準備する', 'pending', 'high', '2024-01-15 09:00:00+00:00'),
    ('食料品の買い物', '今週の食料品を買う', 'completed', 'medium', '2024-01-14 14:30:00+00:00'),
    ('歯医者の予約', '定期検診の予約を取る', 'pending', 'low', '2024-01-13 16:45:00+00:00'),
    ('プロジェクト報告書', '月次プロジェクト報告書を書く', 'pending', 'high', '2024-01-12 10:15:00+00:00'),
    ('運動する', 'ジムに行く', 'completed', 'medium', '2024-01-11 18:00:00+00:00'),
    ('友人との夕食', '友人と夕食の計画を立てる', 'pending', 'low', '2024-01-10 12:30:00+00:00'),
    ('本を読む', '新しい技術書を読む', 'completed', 'medium', '2024-01-09 20:00:00+00:00'),
    ('車の整備', '車の定期整備を予約する', 'pending', 'medium', '2024-01-08 11:00:00+00:00');

-- Create index for better search performance
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at);
CREATE INDEX IF NOT EXISTS idx_todos_title ON todos USING gin(to_tsvector('english', title));
