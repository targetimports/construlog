import React from 'react';
import Sidebar from './Sidebar';

// Wrapper mantido por compatibilidade com o Layout. O menu agora é uma árvore
// expansível (Sidebar), sem modo compacto/flutuante. Largura fixa (240px) é
// definida no Layout via --sidebar-width.
const SidebarCompact = React.memo(function SidebarCompact({ items, isMobile = false, user = null, onNavigate }) {
  return <Sidebar items={items} isMobile={isMobile} user={user} onNavigate={onNavigate} />;
});

export default SidebarCompact;
