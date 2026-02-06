create table "user" (
  user_id     serial8 primary key,
  user_name   text not null,
  email       text not null,
  created_at  timestamptz not null default current_timestamp
);

comment on table "user" is
  'User master. Referenced by task_assignment.';

comment on column "user".user_id is
  'Primary key of user.';
comment on column "user".user_name is
  'Display name of the user.';
comment on column "user".email is
  'Email address of the user.';
comment on column "user".created_at is
  'Timestamp when the user was created.';

create table task (
  task_id     serial8 primary key,
  title       text not null,
  status      text not null,
  priority    integer not null,
  due_date    date,
  created_at  timestamptz not null default current_timestamp
);

comment on table task is
  'Task entity. Current assignee is derived from task_assignment history.';

comment on column task.task_id is
  'Primary key of task.';
comment on column task.title is
  'Short description of the task.';
comment on column task.status is
  'Task status. Example: open, in_progress, done.';
comment on column task.priority is
  'Priority of the task. Higher value means higher priority.';
comment on column task.due_date is
  'Optional due date of the task.';
comment on column task.created_at is
  'Timestamp when the task was created.';

create table task_assignment (
  task_assignment_id serial8 primary key,
  task_id            bigint not null,
  user_id            bigint not null,
  assigned_at        timestamptz not null default current_timestamp
);

comment on table task_assignment is
  'Assignment history of tasks. Latest assigned_at defines current assignee.';

comment on column task_assignment.task_assignment_id is
  'Primary key of task_assignment.';
comment on column task_assignment.task_id is
  'Referenced task identifier.';
comment on column task_assignment.user_id is
  'Referenced user identifier.';
comment on column task_assignment.assigned_at is
  'Timestamp when the task was assigned to the user.';

create index idx_task_assignment_task
  on task_assignment(task_id);

create index idx_task_assignment_task_time
  on task_assignment(task_id, assigned_at desc);

comment on index idx_task_assignment_task is
  'Index for joining task_assignment by task_id.';

comment on index idx_task_assignment_task_time is
  'Index for resolving latest assignment per task.';
