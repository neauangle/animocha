export function createModalController(modalBackground, ...modalInfos){
    let currentModal;

    let eventTarget = (() => {
        let eventTarget = new EventTarget();
        let target = document.createTextNode(null);
        eventTarget.addEventListener = target.addEventListener.bind(target);
        eventTarget.removeEventListener = target.removeEventListener.bind(target);
        eventTarget.dispatchEvent = target.dispatchEvent.bind(target);
        return eventTarget;
    })();

    const ret = {
        addEventListener: eventTarget.addEventListener,
        removeEventListener: eventTarget.removeEventListener,
        dispatchEvent: eventTarget.dispatchEvent,

        getCurrentModal: () => {return currentModal;},
        setActiveModal: function(button, modal){
            if (currentModal){
                currentModal.style.visibility = "hidden";
                currentModal.classList.remove('animate-zoom-in');
                modalBackground.classList.remove('animate-opacity-in');
                currentModal = null;
                if (modalBackground){
                    modalBackground.style.visibility = "hidden";
                }
            }
            if (modal){
                currentModal = modal;
                currentModal.style.visibility = "visible";
                currentModal.classList.add('animate-zoom-in');
                modalBackground.classList.add('animate-opacity-in');
                console.log(currentModal);
                if (modalBackground){
                    modalBackground.style.visibility = "visible";
                }
            } 
            const event = new CustomEvent('modalActivated');
            event.modal = modal;
            event.button = button;
            eventTarget.dispatchEvent(event);
        }
    }

    
    for (let modalInfo of modalInfos){
        modalInfo.modal.addEventListener("click", (event) => {
            event.stopPropagation();
        });
        modalInfo.button.addEventListener('click', async () => {
            ret.setActiveModal(modalInfo.button, modalInfo.modal);
        });
    }

    modalBackground.addEventListener('click', async (event) => {
        ret.setActiveModal(null);
    })


    if (modalBackground){
        var sheet = window.document.styleSheets[window.document.styleSheets.length - 1];
        sheet.insertRule(`#${modalBackground.id} {
            visibility: hidden;
            position: absolute;
            background-color: rgba(0, 0, 0, 0.7);
            width: 100%;
            height: 100%;
            z-index: 6;
        }`, sheet.cssRules.length);
    }

    return ret;
}










