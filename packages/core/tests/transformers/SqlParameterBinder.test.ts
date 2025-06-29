import { describe, it, expect } from 'vitest';
import { SqlParameterBinder } from '../../src/transformers/SqlParameterBinder';
import { SelectQueryParser } from '../../src/parsers/SelectQueryParser';
import { SimpleSelectQuery } from '../../src/models/SelectQuery';
import { SqlFormatter } from '../../src/transformers/SqlFormatter';

describe('SqlParameterBinder', () => {
    describe('bind', () => {
        it('should bind values to existing hardcoded parameters', () => {
            // Arrange
            const sql = 'select year_month from sale_summary where year_month = :ym limit :limit';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder();
            const parameterValues = {
                ym: '2024-06',
                limit: 10
            };

            // Act
            const result = binder.bind(query, parameterValues);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toBe('select "year_month" from "sale_summary" where "year_month" = :ym limit :limit');
            expect(params).toEqual({ ym: '2024-06', limit: 10 });
        });

        it('should bind partial parameters when requireAllParameters is false', () => {
            // Arrange
            const sql = 'select * from users where created_at >= :start_date and status = :status limit :limit';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder({ requireAllParameters: false });
            const parameterValues = {
                start_date: '2024-01-01',
                // status and limit are missing
            };

            // Act
            const result = binder.bind(query, parameterValues);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toContain(':start_date');
            expect(formattedSql).toContain(':status');
            expect(formattedSql).toContain(':limit');
            expect(params.start_date).toBe('2024-01-01');
            expect(params.status).toBe(null);
            expect(params.limit).toBe(null);
        });

        it('should throw error when required parameters are missing', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id and status = :status';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder({ requireAllParameters: true });
            const parameterValues = {
                user_id: 123
                // status is missing
            };

            // Act & Assert
            expect(() => {
                binder.bind(query, parameterValues);
            }).toThrow('Missing values for required parameters: status');
        });

        it('should ignore extra parameters not found in query', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder();
            const parameterValues = {
                user_id: 123,
                extra_param: 'ignored'
            };

            // Act
            const result = binder.bind(query, parameterValues);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toBe('select * from "users" where "id" = :user_id');
            expect(params).toEqual({ user_id: 123 });
        });

        it('should handle query without parameters', () => {
            // Arrange
            const sql = 'select * from users where active = true';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder();
            const parameterValues = {
                some_param: 'value'
            };

            // Act
            const result = binder.bind(query, parameterValues);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toBe('select * from "users" where "active" = true');
            expect(params).toEqual({});
        });

        it('should bind different data types correctly', () => {
            // Arrange
            const sql = 'select * from orders where id = :id and created_at >= :date and amount > :amount and active = :active';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder();
            const parameterValues = {
                id: 123,
                date: new Date('2024-01-01'),
                amount: 99.99,
                active: true
            };

            // Act
            const result = binder.bind(query, parameterValues);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(params.id).toBe(123);
            expect(params.date).toEqual(new Date('2024-01-01'));
            expect(params.amount).toBe(99.99);
            expect(params.active).toBe(true);
        });
    });

    describe('bindToSimpleQuery', () => {
        it('should work as convenience method for SimpleSelectQuery', () => {
            // Arrange
            const sql = 'select * from users where id = :user_id';
            const query = SelectQueryParser.parse(sql) as SimpleSelectQuery;
            const binder = new SqlParameterBinder();
            const parameterValues = { user_id: 123 };

            // Act
            const result = binder.bindToSimpleQuery(query, parameterValues);

            // Assert
            const formatter = new SqlFormatter();
            const { formattedSql, params } = formatter.format(result);
            
            expect(formattedSql).toBe('select * from "users" where "id" = :user_id');
            expect(params).toEqual({ user_id: 123 });
        });
    });
});