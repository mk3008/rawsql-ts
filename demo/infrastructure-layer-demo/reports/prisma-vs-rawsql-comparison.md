# Prisma vs rawsql-ts Architecture Comparison Report

**Generated on:** 2025-06-03T10:21:14.413Z

---

## 📡 Database Connection Test

| Repository | Status |
|------------|--------|
| rawsql-ts | ✅ Connected |
| Prisma | ✅ Connected |

## 📊 Table Search Comparison

### Test Background

This test simulates a **search list functionality** commonly found in enterprise applications:

- **Use Case**: Search functionality with multiple optional filter criteria
- **Search Criteria**: Multiple optional fields (title, status, priority, date ranges, etc.)
- **Result Format**: 2D array structure optimized for table display
- **Data Structure**: Results ignore relational structure - flat data for UI tables
- **Performance Focus**: Query efficiency for paginated list views

**Request:** Get todos matching title "project", status "pending", priority "high"

### rawsql-ts

#### Query1

```sql
with "origin_query" as (select "t"."todo_id", "t"."title", "t"."description", "t"."status", "t"."priority", "t"."created_at" as "todo_created_at", "t"."updated_at" as "todo_updated_at", "c"."category_id", "c"."name" as "category_name", "c"."description" as "category_description", "c"."color" as "category_color", "c"."created_at" as "category_created_at" from "todo" as "t" left join "category" as "c" on "t"."category_id" = "c"."category_id" where "t"."title" like $1 and "t"."status" = $2 and "t"."priority" = $3 order by case "t"."priority" when 'high' then 1 when 'medium' then 2 when 'low' then 3 end, "t"."created_at" desc), "cte_root_todo" as (select jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'createdAt', "todo_created_at", 'updatedAt', "todo_updated_at", 'category_name', "category_name", 'category_color', "category_color") as "todo" from "origin_query") select jsonb_agg("todo") as "todo_array" from "cte_root_todo"
```
**Parameters:** `["%project%","pending","high"]`

**Results:**
```json
[
  {
    "title": "Complete project documentation",
    "status": "pending",
    "todo_id": 1,
    "priority": "high",
    "createdAt": "2025-05-28T12:11:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Write comprehensive docs for the new feature",
    "category_name": "Work",
    "category_color": "#3498db"
  }
]
```

### Prisma

#### Query1

```sql
SELECT "public"."todo"."todo_id", "public"."todo"."title", "public"."todo"."description", "public"."todo"."status", "public"."todo"."priority", "public"."todo"."created_at", "public"."todo"."updated_at", "public"."todo"."category_id" FROM "public"."todo" WHERE ("public"."todo"."title" ILIKE $1 AND "public"."todo"."status" = $2 AND "public"."todo"."priority" = $3) ORDER BY "public"."todo"."priority" ASC, "public"."todo"."created_at" DESC OFFSET $4
```
**Parameters:** `["%project%","pending","high",0]`

#### Query2

```sql
SELECT "public"."category"."category_id", "public"."category"."name", "public"."category"."color" FROM "public"."category" WHERE "public"."category"."category_id" IN ($1) OFFSET $2
```
**Parameters:** `[1,0]`

**Results:**
```json
[
  {
    "todo_id": 1,
    "title": "Complete project documentation",
    "description": "Write comprehensive docs for the new feature",
    "status": "pending",
    "priority": "high",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-28T12:11:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  }
]
```

### Summary

- **rawsql-ts:** 1 queries
- **Prisma:** 2 queries

## 🔗 Cross-Table JOIN Search Comparison

### Test Background

This test simulates a **cross-table search functionality** that requires JOIN operations:

- **Use Case**: Search by attributes that exist only in related tables (not main entity)
- **Search Method**: Mandatory JOIN-based filtering through foreign key relationships
- **Technical Focus**: How each approach handles cross-table filtering
- **Data Structure**: Results must include data from multiple related tables
- **Performance Focus**: Efficient JOIN operations vs N+1 query strategies

**Request:** Get todos filtered by category color "#3498db" (attribute exists only in related category table)

### rawsql-ts

#### Query1

```sql
with "origin_query" as (select "t"."todo_id", "t"."title", "t"."description", "t"."status", "t"."priority", "t"."created_at" as "todo_created_at", "t"."updated_at" as "todo_updated_at", "c"."category_id", "c"."name" as "category_name", "c"."description" as "category_description", "c"."color" as "category_color", "c"."created_at" as "category_created_at" from "todo" as "t" left join "category" as "c" on "t"."category_id" = "c"."category_id" where "c"."color" = $1 order by case "t"."priority" when 'high' then 1 when 'medium' then 2 when 'low' then 3 end, "t"."created_at" desc), "cte_root_todo" as (select jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'createdAt', "todo_created_at", 'updatedAt', "todo_updated_at", 'category_name', "category_name", 'category_color', "category_color") as "todo" from "origin_query") select jsonb_agg("todo") as "todo_array" from "cte_root_todo"
```
**Parameters:** `["#3498db"]`

**Results:**
```json
[
  {
    "title": "Security audit",
    "status": "pending",
    "todo_id": 11,
    "priority": "high",
    "createdAt": "2025-05-29T11:41:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Perform comprehensive security assessment",
    "category_name": "Work",
    "category_color": "#3498db"
  },
  {
    "title": "Implement search feature",
    "status": "pending",
    "todo_id": 5,
    "priority": "high",
    "createdAt": "2025-05-29T11:11:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Add full-text search functionality",
    "category_name": "Work",
    "category_color": "#3498db"
  },
  {
    "title": "Complete project documentation",
    "status": "pending",
    "todo_id": 1,
    "priority": "high",
    "createdAt": "2025-05-28T12:11:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Write comprehensive docs for the new feature",
    "category_name": "Work",
    "category_color": "#3498db"
  },
  {
    "title": "Fix authentication bug",
    "status": "in_progress",
    "todo_id": 2,
    "priority": "high",
    "createdAt": "2025-05-27T12:11:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Resolve login issues reported by users",
    "category_name": "Work",
    "category_color": "#3498db"
  },
  {
    "title": "Deploy to staging",
    "status": "completed",
    "todo_id": 8,
    "priority": "high",
    "createdAt": "2025-05-22T12:11:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Push latest changes to staging environment",
    "category_name": "Work",
    "category_color": "#3498db"
  },
  {
    "title": "Update dependency versions",
    "status": "pending",
    "todo_id": 3,
    "priority": "medium",
    "createdAt": "2025-05-26T12:11:54.59618+00:00",
    "updatedAt": "2025-05-29T12:11:54.59618+00:00",
    "description": "Upgrade all packages to latest stable versions",
    "category_name": "Work",
    "category_color": "#3498db"
  }
]
```

### Prisma

#### Query1

```sql
SELECT "public"."todo"."todo_id", "public"."todo"."title", "public"."todo"."description", "public"."todo"."status", "public"."todo"."priority", "public"."todo"."created_at", "public"."todo"."updated_at", "public"."todo"."category_id" FROM "public"."todo" LEFT JOIN "public"."category" AS "j1" ON ("j1"."category_id") = ("public"."todo"."category_id") WHERE ("j1"."color" = $1 AND ("j1"."category_id" IS NOT NULL)) ORDER BY "public"."todo"."priority" ASC, "public"."todo"."created_at" DESC OFFSET $2
```
**Parameters:** `["#3498db",0]`

#### Query2

```sql
SELECT "public"."category"."category_id", "public"."category"."name", "public"."category"."color" FROM "public"."category" WHERE "public"."category"."category_id" IN ($1) OFFSET $2
```
**Parameters:** `[1,0]`

**Results:**
```json
[
  {
    "todo_id": 11,
    "title": "Security audit",
    "description": "Perform comprehensive security assessment",
    "status": "pending",
    "priority": "high",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-29T11:41:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  },
  {
    "todo_id": 5,
    "title": "Implement search feature",
    "description": "Add full-text search functionality",
    "status": "pending",
    "priority": "high",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-29T11:11:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  },
  {
    "todo_id": 1,
    "title": "Complete project documentation",
    "description": "Write comprehensive docs for the new feature",
    "status": "pending",
    "priority": "high",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-28T12:11:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  },
  {
    "todo_id": 2,
    "title": "Fix authentication bug",
    "description": "Resolve login issues reported by users",
    "status": "in_progress",
    "priority": "high",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-27T12:11:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  },
  {
    "todo_id": 8,
    "title": "Deploy to staging",
    "description": "Push latest changes to staging environment",
    "status": "completed",
    "priority": "high",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-22T12:11:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  },
  {
    "todo_id": 3,
    "title": "Update dependency versions",
    "description": "Upgrade all packages to latest stable versions",
    "status": "pending",
    "priority": "medium",
    "category_name": "Work",
    "category_color": "#3498db",
    "createdAt": "2025-05-26T12:11:54.596Z",
    "updatedAt": "2025-05-29T12:11:54.596Z"
  }
]
```

### Summary

- **rawsql-ts:** 1 queries
- **Prisma:** 2 queries

## 🎯 ID Search Comparison

### Test Background

This test simulates a **detail view functionality** commonly found in enterprise applications:

- **Use Case**: Single record retrieval for detail/edit screens
- **Search Method**: Primary key-based lookup (most efficient database operation)
- **Result Format**: Structured data with full object relationships
- **Data Structure**: Complete entity with nested related objects
- **Performance Focus**: Minimizing query count while retrieving complete data

**Request:** Retrieve todo with ID: 11

### rawsql-ts

#### Query1

```sql
with "origin_query" as (select "t"."todo_id", "t"."title", "t"."description", "t"."status", "t"."priority", "t"."created_at" as "todo_created_at", "t"."updated_at" as "todo_updated_at", "c"."category_id", "c"."name" as "category_name", "c"."description" as "category_description", "c"."color" as "category_color", "c"."created_at" as "category_created_at", "com"."todo_comment_id", "com"."todo_id" as "comment_todo_id", "com"."content" as "comment_content", "com"."author_name" as "comment_author_name", "com"."created_at" as "comment_created_at" from "todo" as "t" left join "category" as "c" on "t"."category_id" = "c"."category_id" left join "todo_comment" as "com" on "t"."todo_id" = "com"."todo_id" where "t"."todo_id" = $1 order by "com"."created_at"), "cte_object_depth_1" as (select *, case when "category_id" is null and "category_name" is null and "category_description" is null and "category_color" is null and "category_created_at" is null then null else jsonb_build_object('category_id', "category_id", 'name', "category_name", 'description', "category_description", 'color', "category_color", 'created_at', "category_created_at") end as "category_json" from "origin_query"), "cte_array_depth_1" as (select "category_json", "todo_id", "title", "description", "status", "priority", "todo_created_at", "todo_updated_at", "category_id", "category_name", "category_description", "category_color", "category_created_at", jsonb_agg(jsonb_build_object('todo_comment_id', "todo_comment_id", 'todo_id', "comment_todo_id", 'content', "comment_content", 'author_name', "comment_author_name", 'created_at', "comment_created_at")) as "comments" from "cte_object_depth_1" group by "category_json", "todo_id", "title", "description", "status", "priority", "todo_created_at", "todo_updated_at", "category_id", "category_name", "category_description", "category_color", "category_created_at"), "cte_root_todo" as (select jsonb_build_object('todo_id', "todo_id", 'title', "title", 'description', "description", 'status', "status", 'priority', "priority", 'category_id', "category_id", 'created_at', "todo_created_at", 'updated_at', "todo_updated_at", 'category', "category_json", 'comments', "comments") as "todo" from "cte_array_depth_1") select "todo" from "cte_root_todo" limit 1
```
**Parameters:** `[11]`

**Result**
```json
{
  "title": "Security audit",
  "status": "pending",
  "todo_id": 11,
  "category": {
    "name": "Work",
    "color": "#3498db",
    "created_at": "2025-05-29T12:11:54.595193+00:00",
    "category_id": 1,
    "description": "Work-related tasks and projects"
  },
  "comments": [
    {
      "content": "Found several potential vulnerabilities",
      "todo_id": 11,
      "created_at": "2025-05-29T11:26:54.597845+00:00",
      "author_name": "Frank Miller",
      "todo_comment_id": 10
    },
    {
      "content": "Updated dependency versions to patch security issues",
      "todo_id": 11,
      "created_at": "2025-05-29T11:56:54.597845+00:00",
      "author_name": "Frank Miller",
      "todo_comment_id": 11
    }
  ],
  "priority": "high",
  "created_at": "2025-05-29T11:41:54.59618+00:00",
  "updated_at": "2025-05-29T12:11:54.59618+00:00",
  "category_id": 1,
  "description": "Perform comprehensive security assessment"
}
```

### Prisma

#### Query1

```sql
SELECT "public"."todo"."todo_id", "public"."todo"."title", "public"."todo"."description", "public"."todo"."status", "public"."todo"."priority", "public"."todo"."category_id", "public"."todo"."created_at", "public"."todo"."updated_at" FROM "public"."todo" WHERE ("public"."todo"."todo_id" = $1 AND 1=1) LIMIT $2 OFFSET $3
```
**Parameters:** `[11,1,0]`

#### Query2

```sql
SELECT "public"."category"."category_id", "public"."category"."name", "public"."category"."description", "public"."category"."color", "public"."category"."created_at" FROM "public"."category" WHERE "public"."category"."category_id" IN ($1) OFFSET $2
```
**Parameters:** `[1,0]`

#### Query3

```sql
SELECT "public"."todo_comment"."todo_comment_id", "public"."todo_comment"."todo_id", "public"."todo_comment"."content", "public"."todo_comment"."author_name", "public"."todo_comment"."created_at" FROM "public"."todo_comment" WHERE "public"."todo_comment"."todo_id" IN ($1) ORDER BY "public"."todo_comment"."created_at" ASC OFFSET $2
```
**Parameters:** `[11,0]`

**Result**
```json
{
  "todo_id": 11,
  "title": "Security audit",
  "description": "Perform comprehensive security assessment",
  "status": "pending",
  "priority": "high",
  "categoryId": 1,
  "createdAt": "2025-05-29T11:41:54.596Z",
  "updatedAt": "2025-05-29T12:11:54.596Z",
  "category": {
    "category_id": 1,
    "name": "Work",
    "description": "Work-related tasks and projects",
    "color": "#3498db",
    "createdAt": "2025-05-29T12:11:54.595Z"
  },
  "comments": [
    {
      "todo_comment_id": 10,
      "todoId": 11,
      "content": "Found several potential vulnerabilities",
      "authorName": "Frank Miller",
      "createdAt": "2025-05-29T11:26:54.597Z"
    },
    {
      "todo_comment_id": 11,
      "todoId": 11,
      "content": "Updated dependency versions to patch security issues",
      "authorName": "Frank Miller",
      "createdAt": "2025-05-29T11:56:54.597Z"
    }
  ]
}
```

### Summary

- **rawsql-ts:** 1 queries
- **Prisma:** 3 queries

