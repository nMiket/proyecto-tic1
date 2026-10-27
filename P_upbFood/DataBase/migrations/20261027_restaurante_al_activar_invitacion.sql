-- El restaurante se crea al completar la activación de la invitación.
-- Mientras la solicitud está aprobada pero la contraseña no se ha configurado,
-- la invitación todavía no tiene un restaurante asociado.
ALTER TABLE invitacion_administrador
    ALTER COLUMN restaurante_id DROP NOT NULL;
