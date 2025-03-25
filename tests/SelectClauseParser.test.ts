import { SelectItem } from "../src/models/Clause";
import { DefaultFormatter } from "../src/models/DefaultFormatter";
import { SelectClauseParser } from "../src/parsers/SelectParser";

const formatter = new DefaultFormatter();

test('simple', () => {
    //Arrange
    const text = `select a.id`;

    // act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select \"a\".\"id\"`);
});

test('multiple columns', () => {
    // Arrange
    const text = `select a.id, a.name, a.created_at`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select \"a\".\"id\", \"a\".\"name\", \"a\".\"created_at\"`);
});

test('with column alias', () => {
    // Arrange
    const text = `select a.id as user_id, a.name as user_name`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select \"a\".\"id\" as \"user_id\", \"a\".\"name\" as \"user_name\"`);
});

test('with identical column alias', () => {
    // Arrange
    const text = `select a.id as id, a.name as name`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select \"a\".\"id\", \"a\".\"name\"`);
});

test('with function call', () => {
    // Arrange
    const text = `select count(*) as count, max(a.value) as max_value`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select count(*) as \"count\", max(\"a\".\"value\") as \"max_value\"`);
});

test('with expression', () => {
    // Arrange
    const text = `select a.price * a.quantity as total`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select \"a\".\"price\" * \"a\".\"quantity\" as \"total\"`);
});

test('with case expression', () => {
    // Arrange
    const text = `select case when a.status = 'active' then 1 else 0 end as is_active`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select case when \"a\".\"status\" = 'active' then 1 else 0 end as \"is_active\"`);
});

test('with column alias without as keyword', () => {
    // Arrange
    const text = `select a.id user_id, a.name user_name`;

    // Act
    const clause = SelectClauseParser.ParseFromText(text);
    const sql = formatter.visit(clause);

    // Assert
    expect(sql).toEqual(`select \"a\".\"id\" as \"user_id\", \"a\".\"name\" as \"user_name\"`);
});
