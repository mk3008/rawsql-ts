# JOIN + Aggregation Decomposer - Edge Cases and Limitations

## テスト結果サマリー

### ✅ サポートされているケース

| パターン | 結果 | 詳細 |
|---------|------|------|
| `COUNT(*)` | ✅ 成功 | `*` をdetail CTEに含めて正常に分解 |
| 基本集計関数 | ✅ 成功 | COUNT, SUM, AVG, MIN, MAX |
| LEFT/RIGHT JOIN | ✅ 成功 | JOIN種別は適切に保持 |
| WHERE句 | ✅ 成功 | detail CTEで条件を保持 |
| 単一JOIN | ✅ 成功 | 基本的なパターンは完全対応 |
| Window関数拒否 | ✅ 成功 | GROUP BYがない場合は適切に拒否 |
| ハイブリッド | ⚠️ 部分対応 | GROUP BY + Window関数は動作するがWindow関数内のカラム参照は変換されない |

### ❌ サポートされていない/制限があるケース

| パターン | 結果 | エラー詳細 |
|---------|------|----------|
| `COUNT(DISTINCT ...)` | ❌ 失敗 | `TypeError: arg.getKind is not a function` |
| 複雑な`SUM`式 | ❌ 失敗 | `SUM(p.price * p.quantity + p.tax)` でフォーマットエラー |
| `CASE`文での集計 | ❌ 失敗 | `SUM(CASE WHEN ... THEN ... END)` でエラー |
| 複数JOIN | 🚫 制限 | Simple版では1JOINまで（設計上の制限） |
| Window関数内参照 | ⚠️ 制限 | `ROW_NUMBER() OVER (ORDER BY COUNT(p.id))` でp.idが変換されない |

## 詳細分析

### 1. COUNT(*) パターン
```sql
-- 元のクエリ
SELECT c.category_name, COUNT(*) as total_records
FROM categories c
JOIN products p ON c.id = p.category_id
GROUP BY c.category_name

-- 分解結果
WITH detail_data AS (
  SELECT c.category_name, * 
  FROM categories AS c 
  JOIN products AS p ON c.id = p.category_id
) 
SELECT category_name, COUNT(*) as total_records 
FROM detail_data 
GROUP BY category_name
```

**✅ 正常動作**: `*` をdetail CTEに含めることで`COUNT(*)`を適切に処理

### 2. 複雑なSUM式パターン
```sql
-- 問題のあるクエリ
SELECT c.category_name, SUM(p.price * p.quantity + p.tax) as total_value
FROM categories c
JOIN products p ON c.id = p.category_id
GROUP BY c.category_name
```

**❌ エラー**: `TypeError: arg.getKind is not a function`
- SqlFormatterの内部でAST処理時にエラー
- 複雑な算術式の処理に課題

### 3. DISTINCT集計パターン
```sql
-- 問題のあるクエリ
SELECT c.category_name, COUNT(DISTINCT p.supplier_id) as unique_suppliers
FROM categories c
JOIN products p ON c.id = p.category_id
GROUP BY c.category_name
```

**❌ エラー**: 同じく`TypeError: arg.getKind is not a function`
- DISTINCT句を含む集計関数の処理に課題

### 4. Window関数パターン
```sql
-- 拒否されるクエリ（期待通り）
SELECT c.category_name, 
       ROW_NUMBER() OVER (PARTITION BY c.category_name ORDER BY p.price DESC) as rank
FROM categories c
JOIN products p ON c.id = p.category_id
```

**✅ 適切に拒否**: "Query does not contain GROUP BY or aggregation functions"

```sql
-- ハイブリッドケース（部分対応）
SELECT c.category_name, COUNT(p.id), 
       ROW_NUMBER() OVER (ORDER BY COUNT(p.id) DESC) as rank
FROM categories c
JOIN products p ON c.id = p.category_id
GROUP BY c.category_name
```

**⚠️ 部分対応**: 動作するがWindow関数内のカラム参照は変換されない

#### 具体例：GROUP BY + Window関数の制限
```sql
-- 元のクエリ
SELECT c.category_name, COUNT(p.id) as product_count,
       ROW_NUMBER() OVER (ORDER BY COUNT(p.id) DESC) as category_rank
FROM categories c JOIN products p ON c.id = p.category_id
GROUP BY c.category_name

-- 実際の分解結果
WITH detail_data AS (
  SELECT c.category_name, p.id, p.price 
  FROM categories AS c JOIN products AS p ON c.id = p.category_id
) 
SELECT category_name, count(id) as product_count,
       row_number() over(order by count(p.id) desc) as category_rank  -- ❌ p.id が残る
FROM detail_data GROUP BY category_name

-- 期待される分解結果
WITH detail_data AS (
  SELECT c.category_name, p.id, p.price 
  FROM categories AS c JOIN products AS p ON c.id = p.category_id
) 
SELECT category_name, count(id) as product_count,
       row_number() over(order by count(id) desc) as category_rank    -- ✅ id に変換
FROM detail_data GROUP BY category_name
```

**❌ 問題**: Window関数内の集計関数の引数（`COUNT(p.id)`）は元テーブル参照のまま

## 改善提案

### 短期改善（現実装の修正）
1. **SqlFormatterエラー修正**: `arg.getKind is not a function` エラーの解決
2. **DISTINCT対応**: DISTINCT句を含む集計関数の処理改善
3. **複雑式対応**: 算術式やCASE文を含む集計の処理改善

### 長期改善（機能拡張）
1. **Advanced版活用**: 複数JOINやHAVING/ORDER BY参照置換
2. **Window関数強化**: ハイブリッドケースでの参照置換
3. **サブクエリ対応**: より複雑なクエリパターンへの対応

## 開発者向けガイドライン

### 現在推奨されるパターン
```sql
-- ✅ これは動作する
SELECT table.column, COUNT(table.id), SUM(table.value), AVG(table.score)
FROM table1 t1
JOIN table2 t2 ON t1.id = t2.t1_id
WHERE conditions
GROUP BY table.column

-- ✅ これも動作する  
SELECT table.column, COUNT(*)
FROM table1 t1
LEFT JOIN table2 t2 ON t1.id = t2.t1_id
GROUP BY table.column
```

### 避けるべきパターン
```sql
-- ❌ 現在サポートされていない
SELECT col, COUNT(DISTINCT other_col)  -- DISTINCT
SELECT col, SUM(a * b + c)             -- 複雑な算術式
SELECT col, SUM(CASE WHEN x THEN y END) -- CASE文
```

### 回避策
複雑な式は事前に計算カラムとして追加：
```sql
-- 回避策: CTE内で事前計算
WITH calculated AS (
  SELECT *, price * quantity + tax as total_cost
  FROM products
)
SELECT category_id, SUM(total_cost)
FROM categories c
JOIN calculated p ON c.id = p.category_id
GROUP BY category_id
```

## まとめ

- **基本パターン**: 十分実用的
- **複雑パターン**: 一部制限あり、改善の余地大
- **エラーハンドリング**: 適切に機能
- **拡張性**: Advanced版で多くの制限を解決可能