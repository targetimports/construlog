import { useEffect } from 'react';
import { menuItems } from './navigation';

/**
 * Validador de Navegação
 * 
 * Valida na inicialização se todas as rotas/páginas
 * configuradas no menu realmente existem
 */
export default function NavigationValidator() {
  useEffect(() => {
    const warnings = [];
    
    const validateMenuItem = (item, parentName = '') => {
      const fullName = parentName ? `${parentName} > ${item.name}` : item.name;
      
      // Verificar se tem página definida
      if (!item.page && !item.submenu) {
        warnings.push(` ${fullName}: sem página definida`);
      }
      
      // Validar submenu recursivamente
      if (item.submenu) {
        item.submenu.forEach(sub => validateMenuItem(sub, fullName));
      }
    };
    
    // Validar todos os itens do menu
    menuItems.forEach(item => validateMenuItem(item));
    
    // Logar warnings se houver
    if (warnings.length > 0) {
      console.group('Validação de Navegação');
      console.warn(`Encontrados ${warnings.length} avisos:`);
      warnings.forEach(w => console.warn(w));
      console.groupEnd();
    } else {
      console.log('Navegação validada: todos os itens têm rotas definidas');
    }
  }, []);
  
  return null;
}