-- 0002 — Dados de exemplo (organização → ambientes → dispositivos).
-- ON CONFLICT DO NOTHING: seguro mesmo que algum id já exista.

INSERT INTO organizations (id, name, active) VALUES
    ('org-demo', 'Organização Demo', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO environments (id, name, type, icon, org_id) VALUES
    ('school-1',   'Escola Central',        'school',     '🏫', 'org-demo'),
    ('indust-1',   'Galpão Industrial A',   'industrial', '🏭', 'org-demo'),
    ('office-1',   'Escritório Open Space', 'office',     '🏢', 'org-demo'),
    ('hospital-1', 'Hospital Geral',        'hospital',   '🏥', 'org-demo')
ON CONFLICT (id) DO NOTHING;

INSERT INTO devices (id, name, env_id, base, warn_threshold, crit_threshold, interval_ms, active) VALUES
    ('s101', 'Sala 101',            'school-1',   55, 70, 85, 1000, true),
    ('s102', 'Sala 102',            'school-1',   62, 70, 85, 1000, true),
    ('s103', 'Sala 103',            'school-1',   50, 70, 85, 1000, true),
    ('lab',  'Lab de Ciências',     'school-1',   70, 70, 85, 1000, true),
    ('bib',  'Biblioteca',          'school-1',   40, 60, 75, 1000, true),
    ('ref',  'Refeitório',          'school-1',   78, 75, 90, 1000, true),
    ('l1',   'Linha de Produção 1', 'indust-1',   84, 80, 90, 1000, true),
    ('l2',   'Linha de Produção 2', 'indust-1',   88, 80, 90, 1000, true),
    ('comp', 'Compressores',        'indust-1',   95, 85, 95, 1000, true),
    ('exp',  'Expedição',           'indust-1',   76, 80, 90, 1000, true),
    ('alm',  'Almoxarifado',        'indust-1',   62, 80, 90, 1000, true),
    ('os',   'Open Space',          'office-1',   63, 65, 80, 1000, true),
    ('sr',   'Sala de Reunião',     'office-1',   58, 65, 80, 1000, true),
    ('copa', 'Copa',                'office-1',   64, 65, 80, 1000, true),
    ('rec',  'Recepção',            'hospital-1', 58, 55, 70, 1000, true),
    ('uti',  'UTI',                 'hospital-1', 45, 50, 60, 1000, true),
    ('enfa', 'Enfermaria A',        'hospital-1', 52, 55, 70, 1000, true),
    ('enfb', 'Enfermaria B',        'hospital-1', 54, 55, 70, 1000, true),
    ('cc',   'Centro Cirúrgico',    'hospital-1', 48, 50, 65, 1000, true),
    ('href', 'Refeitório',          'hospital-1', 61, 65, 80, 1000, true)
ON CONFLICT (id) DO NOTHING;
