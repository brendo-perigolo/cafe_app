type ColheitaListener = (colheitaId: string) => void;

const colheitaListeners = new Set<ColheitaListener>();

export function subscribeColheitaSynced(listener: ColheitaListener): () => void {
    colheitaListeners.add(listener);
    return () => {
        colheitaListeners.delete(listener);
    };
}

export function notifyColheitaSynced(colheitaId: string): void {
    colheitaListeners.forEach((listener) => {
        try {
            listener(colheitaId);
        } catch (error) {
            console.warn('Erro ao notificar sincronização de colheita:', error);
        }
    });
}
