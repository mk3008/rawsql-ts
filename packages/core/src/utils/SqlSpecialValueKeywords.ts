export const SQL_SPECIAL_VALUE_KEYWORDS = [
    'current_catalog',
    'current_date',
    'current_role',
    'current_schema',
    'current_time',
    'current_timestamp',
    'current_user',
    'localtime',
    'localtimestamp',
    'session_user',
    'user'
] as const;

export const SQL_SPECIAL_VALUE_KEYWORD_SET = new Set<string>(SQL_SPECIAL_VALUE_KEYWORDS);
