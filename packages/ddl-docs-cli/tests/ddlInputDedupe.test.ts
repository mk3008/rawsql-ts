import { describe, expect, it } from 'vitest';
import { dedupeDdlInputsByInstanceAndPath } from '../src/utils/ddlInputDedupe';

describe('dedupeDdlInputsByInstanceAndPath', () => {
  it('keeps_same_path_for_different_instances', () => {
    const inputs = [
      { path: 'ztd/ddl/public.sql', instance: 'A' },
      { path: 'ztd/ddl/public.sql', instance: 'B' },
    ];

    const result = dedupeDdlInputsByInstanceAndPath(inputs);

    expect(result).toHaveLength(2);
    expect(result).toEqual(inputs);
  });

  it('dedupes_same_instance_and_same_path', () => {
    const result = dedupeDdlInputsByInstanceAndPath([
      { path: 'ztd/ddl/public.sql', instance: 'A' },
      { path: 'ztd/ddl/public.sql', instance: 'A' },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ path: 'ztd/ddl/public.sql', instance: 'A' });
  });

  it('treats_empty_instance_as_part_of_key', () => {
    const result = dedupeDdlInputsByInstanceAndPath([
      { path: 'ztd/ddl/public.sql', instance: '' },
      { path: 'ztd/ddl/public.sql', instance: '' },
      { path: 'ztd/ddl/public.sql', instance: 'default' },
    ]);

    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { path: 'ztd/ddl/public.sql', instance: '' },
      { path: 'ztd/ddl/public.sql', instance: 'default' },
    ]);
  });
});
