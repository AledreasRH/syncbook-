-- ================================================================
-- SyncBook · SETUP COMPLETO DE BASE DE DATOS
-- Plataforma multi-negocio (igual a Weibook)
-- Ejecutá TODO esto en Supabase → SQL Editor
-- ================================================================

-- ── PASO 1: Deshabilitar confirmación de email ─────────────────
-- En el Dashboard de Supabase:
-- Authentication → Settings → "Enable email confirmations" = OFF

-- ── PASO 2: Tabla negocios ─────────────────────────────────────
-- Cada barbero registra su propio negocio
CREATE TABLE IF NOT EXISTS public.negocios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  descripcion     TEXT,
  telefono        TEXT,
  email           TEXT,
  direccion       TEXT,
  ciudad          TEXT,
  logo_url        TEXT,
  slug            TEXT UNIQUE, -- URL amigable ej: "mi-barberia"
  horario_inicio  TEXT DEFAULT '09:00',
  horario_fin     TEXT DEFAULT '20:00',
  activo          BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── PASO 3: Tabla servicios (vinculada al negocio) ─────────────
CREATE TABLE IF NOT EXISTS public.servicios (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id       UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  descripcion      TEXT,
  duracion_minutos INTEGER NOT NULL DEFAULT 30,
  precio           NUMERIC(10,2) NOT NULL DEFAULT 0,
  imagen_url       TEXT,
  activo           BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── PASO 4: Tabla citas ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.citas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id      UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  servicio_id     UUID REFERENCES public.servicios(id),
  cliente_id      UUID REFERENCES auth.users(id),
  cliente_nombre  TEXT NOT NULL,
  cliente_telefono TEXT NOT NULL,
  fecha           DATE NOT NULL,
  hora_inicio     TEXT NOT NULL,
  hora_fin        TEXT NOT NULL,
  estado          TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','confirmada','cancelada')),
  notas           TEXT,
  fecha_creacion  TIMESTAMPTZ DEFAULT now()
);

-- ── PASO 5: Tabla usuarios (perfil) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_completo TEXT,
  telefono        TEXT,
  rol             TEXT DEFAULT 'cliente' CHECK (rol IN ('cliente','dueno')),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── PASO 6: RLS - Negocios ─────────────────────────────────────
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;

-- Cualquiera puede ver negocios activos (para el catálogo público)
DROP POLICY IF EXISTS "Lectura pública negocios" ON public.negocios;
CREATE POLICY "Lectura pública negocios"
ON public.negocios FOR SELECT TO anon, authenticated
USING (activo = true);

-- Solo el dueño puede crear/editar su negocio
DROP POLICY IF EXISTS "Dueño gestiona su negocio" ON public.negocios;
CREATE POLICY "Dueño gestiona su negocio"
ON public.negocios FOR ALL TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- ── PASO 7: RLS - Servicios ────────────────────────────────────
ALTER TABLE public.servicios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura pública servicios" ON public.servicios;
CREATE POLICY "Lectura pública servicios"
ON public.servicios FOR SELECT TO anon, authenticated
USING (activo = true);

DROP POLICY IF EXISTS "Dueño gestiona servicios" ON public.servicios;
CREATE POLICY "Dueño gestiona servicios"
ON public.servicios FOR ALL TO authenticated
USING (
  negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
)
WITH CHECK (
  negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
);

-- ── PASO 8: RLS - Citas ────────────────────────────────────────
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;

-- Inserción pública (clientes sin cuenta pueden reservar)
DROP POLICY IF EXISTS "Inserción pública citas" ON public.citas;
CREATE POLICY "Inserción pública citas"
ON public.citas FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- Lectura: anon puede leer para verificar conflictos, autenticados ven las suyas
DROP POLICY IF EXISTS "Lectura pública citas" ON public.citas;
CREATE POLICY "Lectura pública citas"
ON public.citas FOR SELECT TO anon, authenticated
USING (true);

-- Dueño puede actualizar citas de su negocio
DROP POLICY IF EXISTS "Dueño actualiza citas" ON public.citas;
CREATE POLICY "Dueño actualiza citas"
ON public.citas FOR UPDATE TO authenticated
USING (
  negocio_id IN (SELECT id FROM public.negocios WHERE owner_id = auth.uid())
);

-- Cliente puede cancelar sus propias citas
DROP POLICY IF EXISTS "Cliente cancela sus citas" ON public.citas;
CREATE POLICY "Cliente cancela sus citas"
ON public.citas FOR UPDATE TO authenticated
USING (cliente_id = auth.uid());

-- ── PASO 9: RLS - Usuarios ─────────────────────────────────────
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lectura propia usuario" ON public.usuarios;
CREATE POLICY "Lectura propia usuario"
ON public.usuarios FOR SELECT TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS "Upsert propio usuario" ON public.usuarios;
CREATE POLICY "Upsert propio usuario"
ON public.usuarios FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- ── PASO 10: Función helper para slug único ────────────────────
CREATE OR REPLACE FUNCTION generar_slug(nombre TEXT)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  base_slug := lower(regexp_replace(nombre, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  final_slug := base_slug;
  WHILE EXISTS (SELECT 1 FROM public.negocios WHERE slug = final_slug) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;
  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;
