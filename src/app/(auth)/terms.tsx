import { APP_DISPLAY_NAME } from '@/constants/app'
import {
  LegalParagraph,
  LegalScreenLayout,
  LegalSection,
} from '@/components/legal/LegalScreenLayout'

export default function TermsScreen() {
  return (
    <LegalScreenLayout title="Términos y Condiciones">
      <LegalSection heading="1. Objeto">
        <LegalParagraph>
          {`Los presentes Términos y Condiciones regulan el acceso y uso de la aplicación móvil ${APP_DISPLAY_NAME}, destinada a facilitar la organización de partidas de mus entre usuarios registrados en España.`}
        </LegalParagraph>
        <LegalParagraph>
          La app no incluye lógica del juego ni apuestas; actúa como herramienta de coordinación
          entre jugadores.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="2. Aceptación">
        <LegalParagraph>
          Al registrarte o usar el servicio declaras haber leído y aceptado estos términos y la
          Política de privacidad. Si no estás de acuerdo, no debes utilizar la aplicación.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="3. Registro y cuenta">
        <LegalParagraph>
          Debes ser mayor de edad y proporcionar datos veraces. Eres responsable de la
          confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.
        </LegalParagraph>
        <LegalParagraph>
          Nos reservamos el derecho de suspender o eliminar cuentas que incumplan estas condiciones
          o las normas de uso aceptable.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="4. Uso del servicio">
        <LegalParagraph>
          {`Te comprometes a utilizar ${APP_DISPLAY_NAME} de forma lícita, respetuosa y conforme a la buena fe. Queda prohibido el acoso, contenido ilegal, suplantación de identidad, spam o cualquier uso que perjudique a otros usuarios o al servicio.`}
        </LegalParagraph>
        <LegalParagraph>
          Las partidas públicas o privadas que publiques son responsabilidad tuya; la app no
          garantiza la asistencia de terceros ni la calidad del encuentro presencial.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="5. Contenido y moderación">
        <LegalParagraph>
          Puedes reportar conductas o contenidos inadecuados. El equipo de moderación podrá revisar
          reportes y aplicar medidas (avisos, bloqueos, eliminación de partidas o resultados) según
          las políticas internas.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="6. Limitación de responsabilidad">
        <LegalParagraph>
          El servicio se ofrece «tal cual». No somos responsables de daños derivados de encuentros
          presenciales entre usuarios, disputas sobre resultados o fallos de conectividad de
          terceros (proveedores de hosting, notificaciones push, etc.).
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="7. Modificaciones">
        <LegalParagraph>
          Podemos actualizar estos términos. Los cambios relevantes se comunicarán en la app o por
          los medios de contacto registrados. El uso continuado tras la publicación implica
          aceptación de la versión vigente.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="8. Ley aplicable">
        <LegalParagraph>
          Estos términos se rigen por la legislación española. Para controversias, las partes se
          someten a los juzgados y tribunales que correspondan según la normativa de consumidores y
          usuarios.
        </LegalParagraph>
      </LegalSection>

      <LegalSection heading="9. Contacto">
        <LegalParagraph>
          Para consultas sobre estos términos puedes escribir a la dirección de contacto indicada en
          la Política de privacidad (pendiente de publicación definitiva).
        </LegalParagraph>
      </LegalSection>
    </LegalScreenLayout>
  )
}
