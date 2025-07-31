const buscarProfesionalPorId = (id) => {
    return new Promise((res, rej) => {
        setTimeout(() => {
            if(id === 1){
                res({nombre: "Ana", rol: "terapeuta"})
            }else{
                rej("Error: profesional no encontrado")
            }
        }, 2000)
    })
}

const main = async () => {
    try {
        console.log("Buscando profesional...")
        const profesional = await buscarProfesionalPorId(1)
        console.log("Profesional:", profesional)
    }catch(error){
        console.log("Error", error)
    }
}

main()
