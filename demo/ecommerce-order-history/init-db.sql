-- Create tables
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    address TEXT
);

CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    order_date DATE NOT NULL DEFAULT CURRENT_DATE,
    customer_id INTEGER REFERENCES customers(customer_id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(order_id),
    product_id INTEGER NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    category_id INTEGER NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL
);

-- Create view for order details with joined data
CREATE VIEW order_details_view AS
SELECT 
    o.order_id,
    o.order_date,
    o.total_amount,
    o.status,
    c.customer_id,
    c.customer_name,
    c.email,
    c.address,
    oi.order_item_id,
    oi.product_id,
    oi.product_name,
    oi.category_id,
    oi.price,
    oi.quantity
FROM 
    orders o
    LEFT JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id;

-- Insert sample data
-- Customers
INSERT INTO customers (customer_name, email, address) VALUES
('John Doe', 'john@example.com', '123 Main St, City'),
('Jane Smith', 'jane@example.com', '456 Oak Ave, Town'),
('Robert Johnson', 'robert@example.com', '789 Pine Rd, Village');

-- Orders
INSERT INTO orders (order_date, customer_id, total_amount, status) VALUES
('2024-01-15', 1, 158.97, 'shipped'),
('2024-02-20', 2, 79.98, 'delivered'),
('2024-03-10', 3, 249.97, 'processing'),
('2024-03-15', 1, 99.99, 'pending'),
('2024-04-05', 2, 349.96, 'shipped');

-- Order items
-- Order 1
INSERT INTO order_items (order_id, product_id, product_name, category_id, price, quantity) VALUES
(1, 101, 'Smartphone', 1, 99.99, 1),
(1, 201, 'Phone Case', 1, 19.99, 1),
(1, 301, 'Screen Protector', 1, 9.99, 2),
(1, 401, 'Charger', 1, 19.00, 1);

-- Order 2
INSERT INTO order_items (order_id, product_id, product_name, category_id, price, quantity) VALUES
(2, 501, 'T-Shirt', 2, 29.99, 2),
(2, 601, 'Jeans', 2, 49.99, 1);

-- Order 3
INSERT INTO order_items (order_id, product_id, product_name, category_id, price, quantity) VALUES
(3, 701, 'Laptop', 3, 199.99, 1),
(3, 801, 'Mouse', 3, 24.99, 1),
(3, 901, 'Keyboard', 3, 24.99, 1);

-- Order 4
INSERT INTO order_items (order_id, product_id, product_name, category_id, price, quantity) VALUES
(4, 102, 'Tablet', 1, 99.99, 1);

-- Order 5
INSERT INTO order_items (order_id, product_id, product_name, category_id, price, quantity) VALUES
(5, 702, 'Gaming Laptop', 3, 299.99, 1),
(5, 802, 'Gaming Mouse', 3, 49.97, 1);