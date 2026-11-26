import { createMachine } from './machine.js';
import { createReportes } from './reportes.js';

export function createRuntime({ db, log }) {
  const reportes = createReportes({ db, log });

  const machine = createMachine({
    log,
    deps: {
      sebas: () => reportes.cartesiano(),
      join: () => reportes.join(),
      delete: () => db.deleteUsuarios(),
      reiniciar: () => undefined,
      reset: async () => {
        await reportes.matar();
        const counts = db.reset();
        log.clear();
        reportes.fijar(counts.pedidos);
        return { filas: counts.pedidos };
      },
    },
  });

  return { machine, reportes };
}
