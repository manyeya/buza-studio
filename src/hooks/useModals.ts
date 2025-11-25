import { useAtom } from 'jotai';
import { isTemplateModalOpenAtom, isVariableLibraryOpenAtom, modalActionsAtom } from '../store/atoms';

export function useModals() {
  const [isTemplateModalOpen] = useAtom(isTemplateModalOpenAtom);
  const [isVariableLibraryOpen] = useAtom(isVariableLibraryOpenAtom);
  const [, dispatch] = useAtom(modalActionsAtom);

  const openTemplateModal = () => {
    dispatch({ type: 'OPEN_TEMPLATE_MODAL' });
  };

  const closeTemplateModal = () => {
    dispatch({ type: 'CLOSE_TEMPLATE_MODAL' });
  };

  const openVariableLibrary = () => {
    dispatch({ type: 'OPEN_VARIABLE_LIBRARY' });
  };

  const closeVariableLibrary = () => {
    dispatch({ type: 'CLOSE_VARIABLE_LIBRARY' });
  };

  return {
    isTemplateModalOpen,
    isVariableLibraryOpen,
    openTemplateModal,
    closeTemplateModal,
    openVariableLibrary,
    closeVariableLibrary
  };
}
